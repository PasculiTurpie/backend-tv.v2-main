const mongoose = require("mongoose");

const SchemaTipoEquipos = new mongoose.Schema(
  {
    tipoNombre: {
      type: String,
      required: true,
      unique: true,     // ✔ evita duplicados
      trim: true,       // ✔ elimina espacios
      lowercase: true,  // ✔ SIEMPRE en minúsculas
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ✔ asegura que el índice único exista realmente en MongoDB
SchemaTipoEquipos.index({ tipoNombre: 1 }, { unique: true });

const TipoEquipo = mongoose.model("TipoEquipo", SchemaTipoEquipos);

module.exports = TipoEquipo;

