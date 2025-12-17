// controllers/ird.controller.js
const mongoose = require("mongoose");
const IRD = require("../models/ird.model");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");

const normalizeLower = (s) => String(s ?? "").trim().toLowerCase();

async function getOrCreateTipoEquipoIdByName(name, { session } = {}) {
  const tipoLower = normalizeLower(name);
  if (!tipoLower) throw { status: 400, message: "TipoEquipo inválido" };

  const found = await TipoEquipo.findOne({ tipoNombreLower: tipoLower })
    .select("_id")
    .lean()
    .session(session);

  if (found?._id) return found._id;

  const created = await TipoEquipo.create(
    [
      {
        tipoNombre: String(name).trim(),
        tipoNombreLower: tipoLower,
      },
    ],
    { session }
  );

  return created?.[0]?._id;
}

async function populateEquipoById(equipoId) {
  if (!equipoId) return null;
  return Equipo.findById(equipoId)
    .populate("tipoNombre") // ✅ aquí viene tipoNombre.tipoNombre
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

      // 2) Resolver TipoEquipo "ird"
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });
      if (!tipoIrdId) {
        throw { status: 500, message: "No se pudo resolver TipoEquipo 'ird'" };
      }

      // 3) Crear Equipo asociado al IRD
      const payloadEquipo = {
        nombre: req.body?.nombreIrd,
        marca: req.body?.marcaIrd,
        modelo: req.body?.modelIrd,
        tipoNombre: tipoIrdId,
        ip_gestion: req.body?.ipAdminIrd ?? null,
        irdRef: createdIrd._id,
      };

      const [equipoDoc] = await Equipo.create([payloadEquipo], { session });
      createdEquipo = equipoDoc;
    });

    // ✅ devolver equipo populado (fuera de la transacción)
    const equipoPopulado = await populateEquipoById(createdEquipo?._id);

    return res.status(201).json({
      ird: createdIrd,
      equipo: equipoPopulado ?? createdEquipo,
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

    return res.status(500).json({ message: "Error al crear IRD (y su Equipo)" });
  } finally {
    session.endSession();
  }
};

module.exports.deleteIrd = async (req, res) => {
  try {
    const id = req.params.id;
    await IRD.findByIdAndDelete(id);
    res.json({ message: "Ird eliminado" });
  } catch (error) {
    console.error("deleteIrd error:", error);
    res.status(500).json({ message: "Error al eliminar ird" });
  }
};

module.exports.updateIrd = async (req, res) => {
  try {
    const id = req.params.id;
    const ird = await IRD.findByIdAndUpdate(id, req.body, { new: true }).lean();
    res.json(ird);
  } catch (error) {
    console.error("updateIrd error:", error);
    res.status(500).json({ message: "Error al actualizar Ird" });
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
