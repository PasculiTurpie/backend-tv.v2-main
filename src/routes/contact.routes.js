const express = require("express");
const ContactController = require("../controllers/contact.controller");

const router = express.Router();

router
  .route("/contact")
  .get(ContactController.getContact)
  .post(ContactController.createContact);

router
  .route("/contact/:id")
  .get(ContactController.getIdContact)
  .put(ContactController.updateContact)
  .delete(ContactController.deleteContact);

module.exports = router;
