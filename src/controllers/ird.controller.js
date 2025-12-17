// controllers/ird.controller.js
const mongoose = require("mongoose");
const IRD = require("../models/ird.model");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");

const normalizeLower = (s) => String(s ?? "").trim().toLowerCase();
const normalizeStr = (s) => String(s ?? "").trim();

async function getOrCreateTipoEquipoIdByName(name, { session } = {}) {
  const tipoLower = normalizeLower(name);
  if (!tipoLower) return null;

  const found = await TipoEquipo.findOne({ tipoNombreLower: tipoLower })
    .select("_id")
    .lean()
    .session(session);

  if (found?._id) return found._id;

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
    let createdEquipo = null;

    await session.withTransaction(async () => {
      // 1) Crear IRD
      const [irdDoc] = await IRD.create([req.body], { session });
      createdIrd = irdDoc;

      if (!createdIrd?._id) {
        throw { status: 500, message: "No se pudo crear IRD" };
      }

      // 2) Asegurar TipoEquipo "ird"
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });
      if (!tipoIrdId) {
        throw { status: 500, message: "No se pudo resolver/crear el TipoEquipo 'ird'." };
      }

      // 3) Crear Equipo asociado y guardar referencia al IRD
      const payloadEquipo = {
        nombre: String(req.body?.nombreIrd ?? "").trim(),
        marca: String(req.body?.marcaIrd ?? "").trim(),
        modelo: String(req.body?.modelIrd ?? "").trim(),
        tipoNombre: tipoIrdId,
        ip_gestion: String(req.body?.ipAdminIrd ?? "").trim() || null,

        // ✅ AQUÍ: el ObjectId del IRD queda en irdRef
        irdRef: createdIrd._id,
      };

      const [equipoDoc] = await Equipo.create([payloadEquipo], { session });
      createdEquipo = equipoDoc;

      if (!createdEquipo?._id) {
        throw { status: 500, message: "No se pudo crear el Equipo asociado" };
      }
    });

    const equipoPopulado = await Equipo.findById(createdEquipo._id)
      .populate("tipoNombre")
      .populate("irdRef")
      .lean();

    return res.status(201).json({
      ird: createdIrd,
      equipo: equipoPopulado,
    });
  } catch (error) {
    console.error("createIrd error:", error);

    if (error?.status) return res.status(error.status).json({ message: error.message });

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
        throw { status: 500, message: "No se pudo resolver/crear el TipoEquipo 'ird'." };
      }

      // 3) ✅ actualizar Equipo por ID si viene (regla que tú quieres)
      const equipoId = req.body?.equipoId || req.body?.equipoRef || null;

      const payloadEquipo = {
        nombre: normalizeStr(req.body?.nombreIrd ?? updatedIrd?.nombreIrd) || "IRD",
        marca: normalizeStr(req.body?.marcaIrd ?? updatedIrd?.marcaIrd) || "IRD",
        modelo: normalizeStr(req.body?.modelIrd ?? updatedIrd?.modelIrd) || "IRD",
        tipoNombre: tipoIrdId,
        ip_gestion: normalizeStr(req.body?.ipAdminIrd ?? updatedIrd?.ipAdminIrd) || null,
        // irdRef NO lo cambies: debe seguir apuntando al mismo IRD
      };

      if (equipoId) {
        updatedEquipo = await Equipo.findByIdAndUpdate(
          equipoId,
          { $set: payloadEquipo, $setOnInsert: { irdRef: updatedIrd._id } },
          { new: true, session }
        );

        // si el equipoId no existe:
        if (!updatedEquipo?._id) {
          throw { status: 404, message: "Equipo no encontrado para el equipoId enviado." };
        }

        // asegurar que quede referenciado al IRD correcto
        if (!updatedEquipo.irdRef) {
          updatedEquipo = await Equipo.findByIdAndUpdate(
            equipoId,
            { $set: { irdRef: updatedIrd._id } },
            { new: true, session }
          );
        }
      } else {
        // Fallback seguro: buscar por irdRef (es único) y actualizar
        updatedEquipo = await Equipo.findOneAndUpdate(
          { irdRef: updatedIrd._id },
          { $set: payloadEquipo },
          { new: true, session }
        );
      }
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

      // Alternativa (si prefieres borrar el equipo asociado):
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
