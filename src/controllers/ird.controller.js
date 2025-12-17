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

/**
 * Ejecuta con transacción si el deployment lo soporta.
 * Si NO lo soporta, ejecuta sin transacción (igual deja el sistema consistente).
 */
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
      // 👇 fallback para Mongo sin replica set
      if (isTransactionNotSupported(err)) {
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
  return createdArr?.[0]?._id ?? null;
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
    console.error("getIrd error:", error);
    res.status(500).json({ message: "Error al obtener ird`s" });
  }
};

module.exports.getIdIrd = async (req, res) => {
  try {
    const id = req.params.id;
    const ird = await IRD.findById(id).lean();
    res.json(ird);
  } catch (error) {
    console.error("getIdIrd error:", error);
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

      // 3) crear Equipo asociado (NUEVO) con irdRef = IRD._id
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
    console.error("createIrd error:", error);

    // ✅ cleanup si IRD alcanzó a crearse (cuando no hay transacciones reales)
    try {
      if (createdIrdId) {
        await IRD.deleteOne({ _id: createdIrdId });
      }
    } catch (cleanupErr) {
      console.warn("cleanup IRD failed:", cleanupErr);
    }

    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      const value = error.keyValue?.[field];
      return res.status(409).json({
        message: `Duplicado: ${field} "${value}"`,
        detail: error.keyValue,
      });
    }

    if (error?.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: "Error al crear IRD" });
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
      const updatedEquipo = await qEq;

      // Si NO existe equipo aún (por errores históricos), lo crea
      let finalEquipo = updatedEquipo;
      if (!finalEquipo?._id) {
        const createdArr = await Equipo.create(
          [
            {
              ...payloadEquipo,
              irdRef: updatedIrd._id,
            },
          ],
          session ? { session } : undefined
        );
        finalEquipo = createdArr?.[0] ?? null;
      }

      const equipoPopulado = await populateEquipoById(finalEquipo?._id);

      return { updatedIrd, equipoPopulado };
    });

    return res.json({ ird: out.updatedIrd, equipo: out.equipoPopulado || null });
  } catch (error) {
    console.error("updateIrd error:", error);

    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      const value = error.keyValue?.[field];
      return res.status(409).json({
        message: `Duplicado: ${field} "${value}"`,
        detail: error.keyValue,
      });
    }

    if (error?.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: "Error al actualizar Ird" });
  }
};

// ===== DELETE =====
module.exports.deleteIrd = async (req, res) => {
  try {
    const id = req.params.id;

    await runWithOptionalTransaction(async ({ session }) => {
      // 1) borrar IRD
      const qDel = IRD.findByIdAndDelete(id);
      if (session) qDel.session(session);
      const deleted = await qDel;

      if (!deleted?._id) throw { status: 404, message: "IRD no encontrado" };

      // 2) borrar o limpiar equipo asociado (recomendado: borrar)
      // Si quieres solo limpiar, cambia a updateMany y set irdRef:null (pero ojo: irdRef unique+sparse igual permite null)
      const qEqDel = Equipo.deleteMany({ irdRef: deleted._id });
      if (session) qEqDel.session(session);
      await qEqDel;
    });

    return res.json({ message: "Ird eliminado" });
  } catch (error) {
    console.error("deleteIrd error:", error);

    if (error?.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: "Error al eliminar ird" });
  }
};
