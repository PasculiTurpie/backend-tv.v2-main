const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema(
  {
    nombreContact: {
      type: String,
      unique: true,
      required: true,
      set: (v) => (v === "" ? undefined : v),
      tirm: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      set: (v) => (v === "" ? undefined : v),
      tirm: true,
    },
    telefono: {
      type: String,
      unique: true,
      sparse: true,
      set: (v) => (v === "" ? undefined : v),
      tirm: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const Contact = mongoose.model("Contact", ContactSchema);
module.exports = Contact;
 