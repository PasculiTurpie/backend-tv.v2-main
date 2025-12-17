const mongoose = require("mongoose");

const SchemaTipoEquipos = new mongoose.Schema(
  {
    tipoNombre: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const TipoEquipo = mongoose.model("TipoEquipo", SchemaTipoEquipos);
module.exports = TipoEquipo;
