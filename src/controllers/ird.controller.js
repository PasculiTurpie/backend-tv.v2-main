const IRD = require('../models/ird.model');


module.exports.getIrd = async (req, res, next) => {
  try {
    const ird = await IRD.find().sort({ ipAdminIrd :1});
    res.json(ird);
  } catch (error) {
    res.status(404).json({ message: 'Error al obtener ird`s' });
  }
}

module.exports.createIrd = async (req, res) => {
  try {
    const ird = new IRD(req.body);
    await ird.save();
    res.status(201).json(ird);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear ird' });
  }
}

module.exports.deleteIrd = async (req, res, next) => {
  try {
    const id = req.params.id;
    await IRD.findByIdAndDelete(id);
    res.json({ message: 'Ird eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar ird' });
  }
}

module.exports.updateIrd = async (req, res) => {
  try {
    const id = req.params.id;
    const ird = await IRD.findByIdAndUpdate(id, req.body, { new: true });
    res.json(ird);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar Ird' });
    }
}

module.exports.getIdIrd = async (req, res, next) => {
  try {
    const id = req.params.id;
    const ird = await IRD.findById(id);
    res.json(ird);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ird' });
    }
}