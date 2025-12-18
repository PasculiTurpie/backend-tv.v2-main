// controllers/ird.controller.js
const mongoose = require("mongoose");
const IRD = require("../models/ird.model");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo");

const normalizeLower = (s) => String(s ?? "").trim().toLowerCase();
const normalizeStr = (s) => String(s ?? "").trim();

function isTransactionNotSupported(err) {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("replica set") ||
    msg.includes("mongos") ||
    msg.includes("does not support transactions") ||
    msg.includes("Retryable writes are not supported")
  );
}

async function runWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work({ session, useSession: true });
      });
      return result;
    } catch (err) {
      console.error("[IRD][TX] Error en transacción:", err?.message || err);
      if (isTransactionNotSupported(err)) {
        console.warn("[IRD][TX] Mongo NO soporta transacciones. Ejecutando SIN session...");
        return await work({ session: null, useSession: false });
      }
      throw err;
    }
  } finally {
    session.endSession();
  }
}

async function getOrCreateTipoEquipoIdByName(name, { session } = {}) {
  const tipoLower = normalizeLower(name);
  if (!tipoLower) return null;

  

  const q = TipoEquipo.findOne({ tipoNombreLower: tipoLower }).select("_id").lean();
  if (session) q.session(session);

  const found = await q;
  

  if (found?._id) return found._id;

  const payload = { tipoNombre: String(name).trim(), tipoNombreLower: tipoLower };
  

  const createdArr = await TipoEquipo.create([payload], session ? { session } : undefined);
  const created = createdArr?.[0];
  

  return created?._id ?? null;
}

async function populateEquipoById(equipoId) {
  if (!equipoId) return null;
  return Equipo.findById(equipoId).populate("tipoNombre").populate("irdRef").lean();
}

// ===== GETS =====
module.exports.getIrd = async (_req, res) => {
  try {
    
    const ird = await IRD.find().sort({ ipAdminIrd: 1 }).lean();
    res.json(ird);
  } catch (error) {
    console.error("[IRD][GET] getIrd error:", error);
    res.status(500).json({ message: "Error al obtener ird`s" });
  }
};

module.exports.getIdIrd = async (req, res) => {
  try {
    const id = req.params.id;
    
    const ird = await IRD.findById(id).lean();
    res.json(ird);
  } catch (error) {
    console.error("[IRD][GET] getIdIrd error:", error);
    res.status(500).json({ message: "Error al obtener ird" });
  }
};

// ===== CREATE =====
module.exports.createIrd = async (req, res) => {
  let createdIrdId = null;

  try {
    

    const out = await runWithOptionalTransaction(async ({ session }) => {
      // 1) crear IRD
      
      const created = await IRD.create([req.body], session ? { session } : undefined);
      const createdIrd = created?.[0];

      

      if (!createdIrd?._id) throw { status: 500, message: "No se pudo crear IRD" };
      createdIrdId = createdIrd._id;

      // 2) TipoEquipo "ird"
      
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });

      

      if (!tipoIrdId) throw { status: 500, message: "No se pudo resolver/crear TipoEquipo 'ird'." };

      // 3) crear Equipo asociado con irdRef = IRD._id
      const payloadEquipo = {
        nombre: normalizeStr(createdIrd.nombreIrd),
        marca: normalizeStr(createdIrd.marcaIrd),
        modelo: normalizeStr(createdIrd.modelIrd),
        tipoNombre: tipoIrdId,
        ip_gestion: normalizeStr(createdIrd.ipAdminIrd) || null,
        irdRef: createdIrd._id,
      };

      

      const eqCreated = await Equipo.create([payloadEquipo], session ? { session } : undefined);
      const equipo = eqCreated?.[0];

      

      if (!equipo?._id) throw { status: 500, message: "No se pudo crear el Equipo asociado." };

      const equipoPopulado = await populateEquipoById(equipo._id);

      return { createdIrd, equipoPopulado };
    });

    return res.status(201).json({
      ird: out.createdIrd,
      equipo: out.equipoPopulado,
      equipoInfo: {
        created: true,
        reason: "Equipo IRD creado automáticamente con irdRef = IRD._id",
        tipoEquipo: "ird",
      },
    });
  } catch (error) {
    console.error("[IRD][CREATE] Error:", error);

    // cleanup si IRD alcanzó a crearse en modo SIN transacciones reales
    try {
      if (createdIrdId) {
        console.warn("[IRD][CREATE] Cleanup: borrando IRD creado por error:", createdIrdId);
        await IRD.deleteOne({ _id: createdIrdId });
      }
    } catch (cleanupErr) {
      console.warn("[IRD][CREATE] cleanup IRD failed:", cleanupErr);
    }

    if (error?.code === 11000) {
      console.error("[IRD][CREATE] Duplicate key:", error?.keyValue);
      const field = Object.keys(error.keyValue || {})[0];
      const value = error.keyValue?.[field];
      return res.status(409).json({
        message: `Duplicado: ${field} "${value}"`,
        detail: error.keyValue,
      });
    }

    if (error?.status) return res.status(error.status).json({ message: error.message });

    return res.status(500).json({
      message: "Error al crear IRD",
      detail: error?.message || error,
    });
  }
};

// ===== UPDATE =====
module.exports.updateIrd = async (req, res) => {
  try {
    const id = req.params.id;
    
    

    const out = await runWithOptionalTransaction(async ({ session }) => {
      // 1) actualizar IRD
      const qIrd = IRD.findByIdAndUpdate(id, req.body, { new: true });
      if (session) qIrd.session(session);
      const updatedIrd = await qIrd.lean();

      

      if (!updatedIrd?._id) throw { status: 404, message: "IRD no encontrado" };

      // 2) TipoEquipo "ird"
      const tipoIrdId = await getOrCreateTipoEquipoIdByName("ird", { session });
      if (!tipoIrdId) throw { status: 500, message: "No se pudo resolver/crear TipoEquipo 'ird'." };

      // 3) actualizar equipo asociado (por irdRef)
      const payloadEquipo = {
        nombre: normalizeStr(updatedIrd.nombreIrd) || "IRD",
        marca: normalizeStr(updatedIrd.marcaIrd) || "IRD",
        modelo: normalizeStr(updatedIrd.modelIrd) || "IRD",
        tipoNombre: tipoIrdId,
        ip_gestion: normalizeStr(updatedIrd.ipAdminIrd) || null,
      };

      

      const qEq = Equipo.findOneAndUpdate(
        { irdRef: updatedIrd._id },
        { $set: payloadEquipo },
        { new: true }
      );
      if (session) qEq.session(session);
      let updatedEquipo = await qEq;

      

      if (!updatedEquipo?._id) {
        console.warn("[IRD][UPDATE] No existía equipo por irdRef, creando uno nuevo...");
        const createdArr = await Equipo.create(
          [{ ...payloadEquipo, irdRef: updatedIrd._id }],
          session ? { session } : undefined
        );
        updatedEquipo = createdArr?.[0] ?? null;
      }

      const equipoPopulado = await populateEquipoById(updatedEquipo?._id);

      return { updatedIrd, equipoPopulado };
    });

    return res.json({ ird: out.updatedIrd, equipo: out.equipoPopulado || null });
  } catch (error) {
    console.error("[IRD][UPDATE] Error:", error);

    if (error?.code === 11000) {
      console.error("[IRD][UPDATE] Duplicate key:", error?.keyValue);
      const field = Object.keys(error.keyValue || {})[0];
      const value = error.keyValue?.[field];
      return res.status(409).json({
        message: `Duplicado: ${field} "${value}"`,
        detail: error.keyValue,
      });
    }

    if (error?.status) return res.status(error.status).json({ message: error.message });

    return res.status(500).json({
      message: "Error al actualizar Ird",
      detail: error?.message || error,
    });
  }
};

// ===== DELETE =====
module.exports.deleteIrd = async (req, res) => {
  try {
    const id = req.params.id;
    

    await runWithOptionalTransaction(async ({ session }) => {
      const qDel = IRD.findByIdAndDelete(id);
      if (session) qDel.session(session);
      const deleted = await qDel;

      

      if (!deleted?._id) throw { status: 404, message: "IRD no encontrado" };

      const qEqDel = Equipo.deleteMany({ irdRef: deleted._id });
      if (session) qEqDel.session(session);
      const delResult = await qEqDel;

      
    });

    return res.json({ message: "Ird eliminado" });
  } catch (error) {
    console.error("[IRD][DELETE] Error:", error);

    if (error?.status) return res.status(error.status).json({ message: error.message });

    return res.status(500).json({
      message: "Error al eliminar ird",
      detail: error?.message || error,
    });
  }
};
