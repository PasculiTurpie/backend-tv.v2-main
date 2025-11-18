const TipoEquipo = require("../models/tipoEquipo");

const sanitize = (doc) => {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(plain._id),
    tipoNombre: plain.tipoNombre,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

module.exports.getTipoEquipo = async (_req, res) => {
  try {
    const tipoEquipo = await TipoEquipo.find().sort({ tipoNombre: 1 }).lean();
    return res.json(tipoEquipo.map(sanitize));
  } catch (error) {
    console.error("Error al obtener tipos de equipo:", error);
    return res.status(500).json({ message: "Error al obtener tipos" });
  }
};

module.exports.getTipoEquipoById = async (req, res) => {
  try {
    const tipoEquipo = await TipoEquipo.findById(req.params.id).lean();
    if (!tipoEquipo) {
      return res.status(404).json({ message: "Tipo de equipo no encontrado" });
    }
    return res.json(sanitize(tipoEquipo));
  } catch (error) {
    console.error("Error al obtener tipo de equipo:", error);
    return res.status(500).json({ message: "Error al obtener tipo de equipo" });
  }
};

module.exports.createTipoEquipo = async (req, res) => {
  try {
    const tipoEquipo = new TipoEquipo(req.body);
    await tipoEquipo.save();
    return res.status(201).json(sanitize(tipoEquipo));
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res.status(409).json({
        message: `Ya existe un tipo de equipo con "${value}" en el campo "${field}".`,
      });
    }

    console.error("Error inesperado al crear tipo de equipo:", error);
    return res.status(500).json({ message: "Error al crear tipo de equipo" });
  }
};

module.exports.updateTipoEquipo = async (req, res) => {
  try {
    const updated = await TipoEquipo.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return res.status(404).json({ message: "Tipo de equipo no encontrado" });
    }

    return res.json(sanitize(updated));
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res.status(409).json({
        message: `Ya existe un tipo de equipo con "${value}" en el campo "${field}".`,
      });
    }
    console.error("Error al actualizar tipo de equipo:", error);
    return res.status(500).json({ message: "Error al actualizar tipo de equipo" });
  }
};

module.exports.deleteTipoEquipo = async (req, res) => {
  try {
    const deleted = await TipoEquipo.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Tipo de equipo no encontrado" });
    }
    return res.json({ message: "Tipo de equipo eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar tipo de equipo:", error);
    return res.status(500).json({ message: "Error al eliminar tipo de equipo" });
  }
};
