import { Injectable } from '@nestjs/common';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class LocalStorageService {
  private readonly root = join(process.cwd(), 'uploads/engineering');

  constructor() {
    mkdir(this.root, { recursive: true }).catch(() => {});
  }

  async save(filename: string, buffer: Buffer): Promise<void> {
    await writeFile(join(this.root, filename), buffer);
  }

  async read(filename: string): Promise<Buffer> {
    return readFile(join(this.root, filename));
  }
}