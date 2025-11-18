const mongoose = require("mongoose");

const SchemaEquipos = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    marca: { type: String, required: true, trim: true },
    modelo: { type: String, required: true, trim: true },
    tipoNombre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TipoEquipo",
      required: true,
      trim: true,
    },
    ip_gestion: {
      type: String,
      trim: true,
      default: null,
    },
    satelliteRef: { type: mongoose.Schema.Types.ObjectId, ref: "Satellite" },
    irdRef: { type: mongoose.Schema.Types.ObjectId, ref: "Ird" },
  },
  { timestamps: true, versionKey: false }
);

// Índice parcial: permite varios null, pero impide duplicar IPs reales
SchemaEquipos.index(
  { ip_gestion: 1 },
  { unique: true, partialFilterExpression: { ip_gestion: { $type: "string" } } }
);
const Equipo = mongoose.model("Equipo", SchemaEquipos);
module.exports = Equipo;
