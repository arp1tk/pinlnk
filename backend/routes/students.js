import express from "express";
import auth from "../middleware/auth.js";
import decrypt from "../middleware/decrypt.js";
import Student from "../models/Student.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch students" });
  }
});

router.post("/", auth, decrypt, async (req, res) => {
  try {
    const student = await Student.create(req.decryptedData);
    return res.status(201).json(student);
  } catch (error) {
    return res.status(500).json({ error: "Failed to create student" });
  }
});

router.put("/:id", auth, decrypt, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.decryptedData,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ error: "Failed to update student" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete student" });
  }
});

export default router;
