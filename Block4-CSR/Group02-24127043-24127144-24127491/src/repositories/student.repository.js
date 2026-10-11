const fs = require('fs/promises');
const path = require('path');

class StudentRepository {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '../../data/students.json');
    this.writeQueue = Promise.resolve();
  }

  async findAll() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      if (!raw.trim()) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.code === 'ENOENT') {
        await this._writeToFile([]);
        return [];
      }
      throw err;
    }
  }

  async create(student) {
    const job = this.writeQueue.then(async () => {
      const students = await this.findAll();
      students.push(student);
      await this._writeToFile(students);
      return student;
    });

    this.writeQueue = job.catch(() => {});
    return job;
  }

  async _writeToFile(students) {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    // Atomic write via temp file
    const tmpFile = `${this.filePath}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(students, null, 2), 'utf8');
    await fs.rename(tmpFile, this.filePath);
  }
  async reset(seedList = null) {
    const defaultSeed = [
      { id: '1728100000001', name: 'Nguyễn Văn An', email: 'an.nguyen@example.com' },
      { id: '1728100000002', name: 'Trần Thị Bình', email: 'binh.tran@example.com' },
      { id: '1728100000003', name: 'Lê Hoàng Cường', email: 'cuong.le@example.com' },
      { id: '1791164915108', name: 'Tuan Van', email: 'tdpus06@gmail.com' },
      { id: '1791166904808', name: 'Duy Phu', email: 'tdp@dev.com' },
    ];
    const dataToSave = seedList || defaultSeed;
    await this._writeToFile(dataToSave);
    return dataToSave;
  }
}

module.exports = new StudentRepository();
