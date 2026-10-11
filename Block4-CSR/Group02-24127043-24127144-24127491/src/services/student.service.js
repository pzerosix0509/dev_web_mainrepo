const studentRepository = require('../repositories/student.repository');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLORS = [
  'bg-indigo-950/80 text-indigo-300 border border-indigo-700/40',
  'bg-purple-950/80 text-purple-300 border border-purple-700/40',
  'bg-cyan-950/80 text-cyan-300 border border-cyan-700/40',
  'bg-emerald-950/80 text-emerald-300 border border-emerald-700/40',
  'bg-amber-950/80 text-amber-300 border border-amber-700/40',
  'bg-rose-950/80 text-rose-300 border border-rose-700/40',
];

class StudentService {
  constructor(repo = studentRepository) {
    this.repo = repo;
  }

  validate({ name, email }) {
    const trimmedName = (name || '').trim();
    const trimmedEmail = (email || '').trim();
    const errors = [];

    if (!trimmedName) {
      errors.push('Full name is required.');
    }

    if (!trimmedEmail) {
      errors.push('Email address is required.');
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.push('Please enter a valid email address.');
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        error: errors[0],
        errors,
      };
    }

    return {
      isValid: true,
      error: null,
      errors: [],
      data: { name: trimmedName, email: trimmedEmail },
    };
  }

  _toViewModel(student, index) {
    const parts = (student.name || '').trim().split(/\s+/).filter(Boolean);
    const initials = parts.length > 0
      ? parts.slice(-2).map((p) => p[0]).join('').toUpperCase()
      : 'ST';

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      initials,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
    };
  }

  async getAllStudents() {
    const rawStudents = await this.repo.findAll();
    return rawStudents.map((s, idx) => this._toViewModel(s, idx));
  }

  async addStudent({ name, email }) {
    const validation = this.validate({ name, email });
    if (!validation.isValid) {
      const err = new Error(validation.error);
      err.status = 400;
      err.errors = validation.errors;
      throw err;
    }

    const existing = await this.repo.findAll();
    const newStudent = {
      id: Date.now().toString(),
      name: validation.data.name,
      email: validation.data.email,
    };

    const saved = await this.repo.create(newStudent);
    return this._toViewModel(saved, existing.length);
  }

  async resetStudents() {
    const raw = await this.repo.reset();
    return raw.map((s, idx) => this._toViewModel(s, idx));
  }
}

module.exports = new StudentService();
