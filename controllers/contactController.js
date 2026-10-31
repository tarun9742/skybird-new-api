const Contact = require("../models/Contact");

exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (typeof name !== "string" || typeof email !== "string" || typeof subject !== "string" || typeof message !== "string" || !name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name, email, subject, and message are required",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const cleanPhone = typeof phone === "string" ? phone.trim() : "";
    if (cleanName.length > 120 || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanSubject.length > 200 || cleanMessage.length > 5000 || cleanPhone.length > 30) {
      return res.status(400).json({ success: false, message: "Please check the form fields and try again" });
    }
    const contact = await Contact.create({ name: cleanName, email: cleanEmail, phone: cleanPhone, subject: cleanSubject, message: cleanMessage });

    res.status(201).json({
      success: true,
      message: "Thank you for reaching out! Our team will get back to you soon.",
      data: contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit inquiry",
    });
  }
};

exports.getAllContacts = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const safeSearch = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { subject: { $regex: safeSearch, $options: "i" } },
        { message: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const contacts = await Contact.find(filter).sort({ createdAt: -1 });

    const totalNew = await Contact.countDocuments({ status: "new" });
    const totalInProgress = await Contact.countDocuments({ status: "in_progress" });
    const totalResolved = await Contact.countDocuments({ status: "resolved" });

    res.status(200).json({
      success: true,
      count: contacts.length,
      counts: {
        total: contacts.length,
        new: totalNew,
        inProgress: totalInProgress,
        resolved: totalResolved,
      },
      data: contacts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateContactStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact query not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact query not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Query deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
