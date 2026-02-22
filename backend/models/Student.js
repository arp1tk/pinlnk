import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, trim: true },
    grade: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);

export default Student;
