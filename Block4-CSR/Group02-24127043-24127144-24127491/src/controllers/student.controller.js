const path = require('path');
const studentService = require('../services/student.service');

class StudentController {
  constructor(service = studentService) {
    this.service = service;
  }

  // CSR Shell: Server only returns the empty HTML shell (<div id="root"></div>).
  // No template engine (EJS) is used; React renders the UI in the browser.
  serveAppShell = (req, res) => {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  };

  // GET /api/students -> 200 OK JSON array
  listStudentsJson = async (req, res, next) => {
    try {
      const students = await this.service.getAllStudents();
      return res.status(200).json(students);
    } catch (err) {
      return next(err);
    }
  };

  // POST /api/students -> 201 Created JSON record or 400 Bad Request JSON errors
  createStudentJson = async (req, res, next) => {
    const rawName = req.body?.name || '';
    const rawEmail = req.body?.email || '';

    const validation = this.service.validate({ name: rawName, email: rawEmail });
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error,
        errors: validation.errors,
      });
    }

    try {
      const created = await this.service.addStudent({ name: rawName, email: rawEmail });
      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  };

  // POST /api/students/reset -> 200 OK with restored seed students
  resetStudentsJson = async (req, res, next) => {
    try {
      const students = await this.service.resetStudents();
      return res.status(200).json({ ok: true, count: students.length, students });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = new StudentController();
