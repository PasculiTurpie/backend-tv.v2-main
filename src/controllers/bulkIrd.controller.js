const XLSX = require("xlsx");
const mongoose = require("mongoose");
const Ird = require("../models/ird.model"); // Ajusta la ruta según tu estructura
const Equipo = require("../models/equipo.model"); // Ajusta la ruta según tu estructura
const TipoEquipo = require("../models/tipoEquipo"); // Ajusta la ruta según tu estructura

// Función para limpiar y validar datos
const cleanAndValidateData = (data) => {
  const cleaned = {};

  // Campos requeridos con validaciones específicas
  const requiredFields = ["nombreIrd", "ipAdminIrd"];

  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === "") {
      throw new Error(`Campo requerido faltante: ${field}`);
    }
    cleaned[field] = String(data[field]).trim();
  }

  // Campos opcionales con limpieza
  const optionalFields = [
    "urlIrd",
    "marcaIrd",
    "modelIrd",
    "versionIrd",
    "uaIrd",
    "tidReceptor",
    "typeReceptor",
    "feqReceptor",
    "symbolRateIrd",
    "fecReceptorIrd",
    "modulationReceptorIrd",
    "rellOfReceptor",
    "nidReceptor",
    "cvirtualReceptor",
    "vctReceptor",
    "outputReceptor",
    "multicastReceptor",
    "ipVideoMulticast",
    "locationRow",
    "locationCol",
    "swAdmin",
    "portSw",
  ];

  for (const field of optionalFields) {
    if (data[field] && String(data[field]).trim() !== "") {
      cleaned[field] = String(data[field]).trim();
    }
  }

  // Validación de IP
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(cleaned.ipAdminIrd)) {
    throw new Error(`IP inválida: ${cleaned.ipAdminIrd}`);
  }

  return cleaned;
};

// Función para obtener o crear TipoEquipo para IRD
const getOrCreateIrdTipoEquipo = async () => {
  let tipoIrd = await TipoEquipo.findOne({ tipoNombre: "IRD" });

  if (!tipoIrd) {
    tipoIrd = new TipoEquipo({
      tipoNombre: "IRD",
      descripcion: "Integrated Receiver Decoder",
    });
    await tipoIrd.save();
  }

  return tipoIrd;
};

// Función principal de procesamiento
const processIrdData = async (excelData) => {
  const results = {
    successful: [],
    errors: [],
    summary: {
      totalProcessed: 0,
      irdsCreated: 0,
      equiposCreated: 0,
      errors: 0,
    },
  };

  // Obtener el TipoEquipo para IRD
  const tipoIrd = await getOrCreateIrdTipoEquipo();

  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    const rowNumber = i + 2; // +2 porque Excel empieza en 1 y la primera fila son headers

    try {
      results.summary.totalProcessed++;

      // Limpiar y validar datos
      const cleanData = cleanAndValidateData(row);

      // Verificar si ya existe el IRD
      const existingIrd = await Ird.findOne({
        $or: [
          { nombreIrd: cleanData.nombreIrd },
          { ipAdminIrd: cleanData.ipAdminIrd },
        ],
      });

      if (existingIrd) {
        throw new Error(
          `IRD ya existe (nombre: ${cleanData.nombreIrd} o IP: ${cleanData.ipAdminIrd})`
        );
      }

      // Crear el IRD
      const newIrd = new Ird(cleanData);
      await newIrd.save();
      results.summary.irdsCreated++;

      // Crear el Equipo asociado
      const equipoData = {
        nombre: cleanData.nombreIrd,
        marca: cleanData.marcaIrd || "N/A",
        modelo: cleanData.modelIrd || "N/A",
        tipoNombre: tipoIrd._id,
        ip_gestion: cleanData.ipAdminIrd,
        irdRef: newIrd._id,
      };

      const newEquipo = new Equipo(equipoData);
      await newEquipo.save();
      results.summary.equiposCreated++;

      results.successful.push({
        row: rowNumber,
        irdId: newIrd._id,
        equipoId: newEquipo._id,
        nombre: cleanData.nombreIrd,
        ip: cleanData.ipAdminIrd,
      });
    } catch (error) {
      results.summary.errors++;
      results.errors.push({
        row: rowNumber,
        data: row,
        error: error.message,
      });
    }
  }

  return results;
};

// Controlador principal
const bulkCreateIrds = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se encontró archivo Excel",
      });
    }

    // Leer el archivo Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0]; // Primera hoja
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    if (excelData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El archivo Excel está vacío",
      });
    }

    // Procesar datos
    const results = await processIrdData(excelData);

    // Respuesta
    res.json({
      success: true,
      message: "Procesamiento completado",
      data: results,
    });
  } catch (error) {
    console.error("Error en carga masiva de IRDs:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

// Función para validar el formato del Excel antes de procesar
const validateExcelFormat = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se encontró archivo Excel",
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: "El archivo Excel no tiene hojas válidas",
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El archivo Excel está vacío",
      });
    }

    const headers = data[0] || [];
    const expectedHeaders = ["nombreIrd", "ipAdminIrd", "marcaIrd", "modelIrd"];
    const missingHeaders = expectedHeaders.filter(
      (header) => !headers.includes(header)
    );

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Formato de archivo incorrecto",
        missingHeaders: missingHeaders,
        foundHeaders: headers,
      });
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    const preview = jsonData.slice(0, 5);

    return res.json({
      success: true,
      message: "Formato válido",
      headers: headers,
      preview: preview,
      totalRows: jsonData.length,
    });
  } catch (error) {
    console.error("Error en validateExcelFormat:", error);
    return res.status(500).json({
      success: false,
      message: "Error al validar archivo",
      error: error.message,
    });
  }
};

module.exports = {
  bulkCreateIrds,
  validateExcelFormat,
};
