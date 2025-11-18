const Contact = require("../models/contact.model");

module.exports.createContact = async (req, res) => {
  try {
    const contact = new Contact(req.body);
    await contact.save();
    return res.status(201).json(contact);
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res
        .status(409)
        .json({ message: `Ya existe un contacto con ${field}: "${value}"` });
    }
    console.error("Error al crear contacto:", error);
    return res
      .status(500)
      .json({ message: "Error al crear contacto" });
  }
};

module.exports.getContact = async (_req, res) => {
  try {
    const contact = await Contact.find().lean();
    return res.json(contact);
  } catch (error) {
    console.error("Error al obtener contactos:", error);
    return res.status(500).json({ message: "Error al obtener contacto" });
  }
};

module.exports.getIdContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).lean();
    if (!contact) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }
    return res.json(contact);
  } catch (error) {
    console.error("Error al obtener contacto:", error);
    return res.status(500).json({ message: "Error al obtener contacto" });
  }
};

module.exports.updateContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!contact) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }
    return res.json(contact);
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return res
        .status(409)
        .json({ message: `Ya existe un contacto con ${field}: "${value}"` });
    }
    console.error("Error al actualizar contacto:", error);
    return res.status(500).json({ message: "Error al actualizar contacto" });
  }
};

module.exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id).lean();
    if (!contact) {
      return res.status(404).json({ message: "Contacto no encontrado" });
    }
    return res.json({ message: "Contacto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar contacto:", error);
    return res.status(500).json({ message: "Error al eliminar contacto" });
  }
};
