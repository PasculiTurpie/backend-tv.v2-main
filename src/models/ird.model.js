const mongoose = require("mongoose");

const IrdSchema = new mongoose.Schema(
  {
    urlIrd: {
      type: String,
      default: "https://i.ibb.co/pvW06r6K/ird-motorola.png",
      trim: true,
    },
    nombreIrd: {
      type: String,
      unique: true,
      trim: true,
    },
    ipAdminIrd: {
      type: String,
      unique: true,
      trim: true,
    },
    marcaIrd: {
      type: String,
      trim: true,
    },
    modelIrd: {
      type: String,
      trim: true,
    },
    versionIrd: {
      type: String,
      trim: true,
    },
    uaIrd: {
      type: String,
      trim: true,
    },
    tidReceptor: {
      type: String,
      trim: true,
    },
    typeReceptor: {
      type: String,
      trim: true,
    },
    feqReceptor: {
      type: String,
      trim: true,
    },
    symbolRateIrd: {
      type: String,
      trim: true,
    },
    fecReceptorIrd: {
      type: String,
      trim: true,
    },
    modulationReceptorIrd: {
      type: String,
      trim: true,
    },
    rellOfReceptor: {
      type: String,
      trim: true,
    },
    nidReceptor: {
      type: String,
      trim: true,
    },
    cvirtualReceptor: {
      type: String,
      trim: true,
    },
    vctReceptor: {
      type: String,
      trim: true,
    },
    outputReceptor: {
      type: String,
      trim: true,
    },
    multicastReceptor: {
      type: String,
      trim: true,
    },
    ipVideoMulticast: {
      type: String,
      trim: true,
    },
    locationRow: {
      type: String,
      trim: true,
    },
    locationCol: {
      type: String,
      trim: true,
    },
    swAdmin: {
      type: String,
      trim: true,
    },
    portSw: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const Ird = mongoose.model("Ird", IrdSchema);
module.exports = Ird;
