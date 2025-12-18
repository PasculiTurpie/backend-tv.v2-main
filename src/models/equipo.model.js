// models/equipo.model.js
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
    },

    // ✅ ahora permite repetidos (para carga masiva)
    ip_gestion: {
      type: String,
      trim: true,
      default: null,
    },

    satelliteRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Satellite",
      default: null,
    },

    // ✅ 1 IRD = 1 Equipo (evita duplicados por reintentos)
    irdRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ird",
      sparse: true,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

/**
 * ✅ Índices
 */

// ✅ Índice normal (NO único) para búsquedas por IP (permite repetidos)
SchemaEquipos.index({ ip_gestion: 1 });

// ✅ Extra carga masiva: asegura 1 Equipo por cada IRD (evita duplicados por reintentos)
// - Permite múltiples null
// - Solo aplica unique cuando irdRef exista (ObjectId)
SchemaEquipos.index(
  { irdRef: 1 },
  {
    unique: true,
    partialFilterExpression: { irdRef: { $type: "objectId" } },
  }
);

const Equipo = mongoose.model("Equipo", SchemaEquipos);
module.exports = Equipo;
