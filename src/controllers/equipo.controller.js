const mongoose = require("mongoose");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");
const Ird = require("../models/ird.model");
const Satellite = require("../models/satellite.model");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

async function resolveTipoEquipoId(rawValue) {
  const value = rawValue ?? null;
  if (value === null || value === undefined || value === "") {
    throw { status: 400, message: "El tipo de equipo es obligatorio" };
  }

  if (isValidObjectId(value)) {
    const exists = await TipoEquipo.exists({ _id: value });
    if (!exists) {
      throw { status: 404, message: "Tipo de equipo no encontrado" };
    }
    return value;
  }

  const nombre = String(value).trim();
  if (!nombre) {
    throw { status: 400, message: "El tipo de equipo es obligatorio" };
  }

  const existing = await TipoEquipo.findOne({ tipoNombre: nombre })
    .select("_id")
    .lean();

  if (existing) {
    return existing._id;
  }

  const created = await TipoEquipo.create({ tipoNombre: nombre });
  return created._id;
}

async function resolveIrdRef(rawValue) {
  if (rawValue === undefined) return undefined;
  if (rawValue === null || rawValue === "") return null;
  if (!isValidObjectId(rawValue)) {
    throw { status: 400, message: "Identificador de IRD inválido" };
  }
  const exists = await Ird.exists({ _id: rawValue });
  if (!exists) {
    throw { status: 404, message: "IRD no encontrado" };
  }
  return rawValue;
}

async function resolveSatelliteRef(rawValue) {
  if (rawValue === undefined) return undefined;
  if (rawValue === null || rawValue === "") return null;
  if (!isValidObjectId(rawValue)) {
    throw { status: 400, message: "Identificador de satélite inválido" };
  }
  const exists = await Satellite.exists({ _id: rawValue });
  if (!exists) {
    throw { status: 404, message: "Satélite no encontrado" };
  }
  return rawValue;
}

function mapIncomingPayload(payload = {}) {
  return {
    nombre: payload.nombre ?? payload.nombreEquipo ?? null,
    marca: payload.marca ?? payload.marcaEquipo ?? null,
    modelo: payload.modelo ?? payload.modelEquipo ?? null,
    tipoNombre:
      payload.tipoNombre ?? payload.tipoNombreId ?? payload.tipo ?? payload.tipo_equipo,
    ip_gestion: payload.ip_gestion ?? payload.ipAdminEquipo ?? null,
    irdRef: payload.irdRef ?? null,
    satelliteRef: payload.satelliteRef ?? payload.satellite ?? null,
  };
}

async function populateEquipo(doc) {
  if (!doc) return null;
  const equipo = await Equipo.findById(doc._id)
    .populate("tipoNombre")
    .populate("irdRef")
    .populate({
      path: "satelliteRef",
      populate: [{ path: "satelliteType", select: "typePolarization" }],
    })
    .lean();
  return equipo;
}

module.exports.createEquipo = async (req, res) => {
  try {
    const payload = mapIncomingPayload(req.body);

    payload.tipoNombre = await resolveTipoEquipoId(payload.tipoNombre);
    payload.irdRef = await resolveIrdRef(payload.irdRef);
    payload.satelliteRef = await resolveSatelliteRef(payload.satelliteRef);

    ["nombre", "marca", "modelo"].forEach((field) => {
      if (payload[field]) payload[field] = String(payload[field]).trim();
    });
    if (payload.ip_gestion) payload.ip_gestion = String(payload.ip_gestion).trim();

    const created = await Equipo.create(payload);
    const populated = await populateEquipo(created);

    return res.status(201).json(populated);
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res.status(409).json({
        message: `Ya existe un equipo con ${field}: "${value}"`,
        detail: error.keyValue,
      });
    }
    console.error("Error al crear equipo:", error);
    return res.status(500).json({ message: "Error al crear equipo" });
  }
};

module.exports.getEquipo = async (_req, res) => {
  try {
    const equipos = await Equipo.find()
      .populate("tipoNombre")
      .populate("irdRef")
      .populate({
        path: "satelliteRef",
        populate: [{ path: "satelliteType", select: "typePolarization" }],
      })
      .lean();
    return res.json(equipos);
  } catch (error) {
    console.error("getEquipo error:", error);
    return res.status(500).json({ message: "Error al obtener equipos" });
  }
};

module.exports.getIdEquipo = async (req, res) => {
  try {
    const equipo = await Equipo.findById(req.params.id)
      .populate("tipoNombre")
      .populate("irdRef")
      .populate({
        path: "satelliteRef",
        populate: [{ path: "satelliteType", select: "typePolarization" }],
      })
      .lean();

    if (!equipo) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }

    return res.json(equipo);
  } catch (error) {
    console.error("getIdEquipo error:", error);
    return res.status(500).json({ message: "Error al obtener equipo" });
  }
};

module.exports.updateEquipo = async (req, res) => {
  try {
    const patch = mapIncomingPayload(req.body);

    if (patch.tipoNombre !== undefined) {
      patch.tipoNombre = await resolveTipoEquipoId(patch.tipoNombre);
    }
    if (patch.irdRef !== undefined) {
      patch.irdRef = await resolveIrdRef(patch.irdRef);
    }
    if (patch.satelliteRef !== undefined) {
      patch.satelliteRef = await resolveSatelliteRef(patch.satelliteRef);
    }

    ["nombre", "marca", "modelo", "ip_gestion"].forEach((field) => {
      if (patch[field]) patch[field] = String(patch[field]).trim();
    });

    const updated = await Equipo.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }

    const populated = await populateEquipo(updated);
    return res.json(populated);
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res
        .status(409)
        .json({ message: `Ya existe un equipo con ${field}: "${value}"` });
    }
    console.error("updateEquipo error:", error);
    return res.status(500).json({ message: "Error al actualizar equipo" });
  }
};

module.exports.deleteEquipo = async (req, res) => {
  try {
    const deleted = await Equipo.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }
    return res.json({ message: "Equipo eliminado correctamente" });
  } catch (error) {
    console.error("deleteEquipo error:", error);
    return res.status(500).json({ message: "Error al eliminar equipo" });
  }
};
