/* eslint-disable space-before-function-paren */
import 'dotenv/config'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { MemorySessionStorage } from 'grammy'

export class FileSessionStorage extends MemorySessionStorage<any> {
  constructor() {
    super()
  }

  static load(key: string) {
    const fname = `./storage/${key}.json`
    if (existsSync(fname)) return JSON.parse(readFileSync(fname).toString())
    return undefined
  }

  static store(key: string, value: any) {
    const fname = `./storage/${key}.json`
    writeFileSync(fname, JSON.stringify(value))
  }

  write(key: any, value: any) {
    this.storage.set(key, value)
    FileSessionStorage.store(key, value)
  }

  read(key: any) {
    const value = this.storage.get(key)
    if (value === undefined) return FileSessionStorage.load(key)
    return value
  }
}
