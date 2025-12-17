// controllers/ird.controller.js
const mongoose = require("mongoose");
const IRD = require("../models/ird.model");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");

const normalizeLower = (s) => String(s ?? "").trim().toLowerCase();

async function getOrCreateTipoEquipoIdByName(name, { session } = {}) {
  const tipoLower = normalizeLower(name);
  if (!tipoLower) return null;

  // 1) buscar por lower (tu enfoque actual)
  const found = await TipoEquipo.findOne({ tipoNombreLower: tipoLower })
    .select("_id")
    .lean()
    .session(session);

  if (found?._id) return found._id;

  // 2) si no existe, crear (lo que necesitas)
  const payload = {
    tipoNombre: String(name).trim(),
    tipoNombreLower: tipoLower,
  };

  const [created] = await TipoEquipo.create([payload], { session });
  return created?._id ?? null;
}

async function populateEquipoById(equipoId) {
  if (!equipoId) return null;
  return Equipo.findById(equipoId)
    .populate("tipoNombre")
    .populate("irdRef")
    .lean();
}

module.exports.getIrd = async (_req, res) => {
  try {
    const ird = await IRD.find().sort({ ipAdminIrd: 1 }).lean();
    res.json(ird);
  } catch (error) {
    console.error("getIrd error:", error);
    res.status(500).json({ message: "Error al obtener ird`s" });
  }
};

module.exports.getIdIrd = async (req, res) => {
  try {
    const id = req.params.id;
    const ird = await IRD.findById(id).lean();
    res.json(ird);
  } catch (error) {
    console.error("getIdIrd error:", error);
    res.status(500).json({ message: "Error al obtener ird" });
  }
};

module.exports.createIrd = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let createdIrd = null;
    let upsertedEquipo = null;

    await session.withTransaction(async () => {
      // 1) Crear IRD
      const [irdDoc] = await IRD.create([req.body], { session });
      createdIrd = irdDoc;

      if (!createdIrd?._id) {
        throw { status: 500, message: "No se pudo crear IRD" };
      }

      // 2) Asegurar TipoEquipo "ird" (buscar o crear)
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });
      if (!tipoIrdId) {
        throw {
          status: 500,
          message:
            "No se pudo resolver/crear el TipoEquipo 'ird'. No se creó el Equipo asociado.",
        };
      }

      // 3) Crear o actualizar Equipo asociado (UPsert por ip_gestion)
      const ipGestion = req.body?.ipAdminIrd?.trim() || null;

      const payloadEquipo = {
        nombre: req.body?.nombreIrd?.trim() || "IRD",
        marca: req.body?.marcaIrd?.trim() || "IRD",
        modelo: req.body?.modelIrd?.trim() || "IRD",
        tipoNombre: tipoIrdId,
        ip_gestion: ipGestion,
        irdRef: createdIrd._id,
      };

      // Si ya existe un equipo con esa IP, lo actualiza y le setea el irdRef.
      // Si no existe, lo crea.
      upsertedEquipo = await Equipo.findOneAndUpdate(
        { ip_gestion: ipGestion },
        { $set: payloadEquipo },
        {
          new: true,
          upsert: true,
          session,
          setDefaultsOnInsert: true,
        }
      );
    });

    const equipoPopulado = await populateEquipoById(upsertedEquipo?._id);

    return res.status(201).json({
      ird: createdIrd,
      equipo: equipoPopulado || null,
      equipoInfo: {
        created: Boolean(upsertedEquipo?._id),
        reason: upsertedEquipo?._id
          ? "Equipo asociado creado/actualizado automáticamente."
          : "No se pudo crear/actualizar el Equipo asociado.",
        tipoEquipo: "ird",
      },
    });
  } catch (error) {
    console.error("createIrd error:", error);

    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }

    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      const value = error.keyValue?.[field];
      return res.status(409).json({
        message: `Duplicado: ${field} "${value}"`,
        detail: error.keyValue,
      });
    }

    return res.status(500).json({ message: "Error al crear IRD" });
  } finally {
    session.endSession();
  }
};

module.exports.updateIrd = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let updatedIrd = null;
    let updatedEquipo = null;

    await session.withTransaction(async () => {
      const id = req.params.id;

      // 1) actualizar IRD
      updatedIrd = await IRD.findByIdAndUpdate(id, req.body, { new: true, session }).lean();
      if (!updatedIrd?._id) {
        throw { status: 404, message: "IRD no encontrado" };
      }

      // 2) asegurar TipoEquipo "ird"
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });
      if (!tipoIrdId) {
        throw {
          status: 500,
          message: "No se pudo resolver/crear el TipoEquipo 'ird'.",
        };
      }

      // 3) sincronizar Equipo asociado (por irdRef)
      const ipGestion = (req.body?.ipAdminIrd ?? updatedIrd?.ipAdminIrd ?? null);
      const payloadEquipo = {
        nombre: (req.body?.nombreIrd ?? updatedIrd?.nombreIrd ?? "IRD").trim?.() ?? "IRD",
        marca: (req.body?.marcaIrd ?? updatedIrd?.marcaIrd ?? "IRD").trim?.() ?? "IRD",
        modelo: (req.body?.modelIrd ?? updatedIrd?.modelIrd ?? "IRD").trim?.() ?? "IRD",
        tipoNombre: tipoIrdId,
        ip_gestion: typeof ipGestion === "string" ? ipGestion.trim() : null,
      };

      // si existe equipo por irdRef -> update
      // si no existe -> lo crea (upsert) por irdRef
      updatedEquipo = await Equipo.findOneAndUpdate(
        { irdRef: updatedIrd._id },
        { $set: payloadEquipo, $setOnInsert: { irdRef: updatedIrd._id } },
        {
          new: true,
          upsert: true,
          session,
          setDefaultsOnInsert: true,
        }
      );
    });

    const equipoPopulado = await populateEquipoById(updatedEquipo?._id);

    return res.json({
      ird: updatedIrd,
      equipo: equipoPopulado || null,
    });
  } catch (error) {
    console.error("updateIrd error:", error);

    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }

    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      const value = error.keyValue?.[field];
      return res.status(409).json({
        message: `Duplicado: ${field} "${value}"`,
        detail: error.keyValue,
      });
    }

    return res.status(500).json({ message: "Error al actualizar Ird" });
  } finally {
    session.endSession();
  }
};

module.exports.deleteIrd = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const id = req.params.id;

      // 1) borrar IRD
      const deleted = await IRD.findByIdAndDelete(id, { session });
      if (!deleted?._id) {
        throw { status: 404, message: "IRD no encontrado" };
      }

      // 2) limpiar referencia en Equipo (recomendado)
      await Equipo.updateMany(
        { irdRef: deleted._id },
        { $set: { irdRef: null } },
        { session }
      );

      // Alternativa (si prefieres borrar el equipo del IRD):
      // await Equipo.deleteMany({ irdRef: deleted._id }, { session });
    });

    return res.json({ message: "Ird eliminado" });
  } catch (error) {
    console.error("deleteIrd error:", error);

    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }

    return res.status(500).json({ message: "Error al eliminar ird" });
  } finally {
    session.endSession();
  }
};