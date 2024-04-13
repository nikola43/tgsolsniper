/* eslint-disable space-before-function-paren */
import 'dotenv/config'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { MemorySessionStorage } from 'grammy'

export class FileSessionStorage extends MemorySessionStorage {
  static load(key) {
    const fname = `./storage/${key}.json`
    if (existsSync(fname)) return JSON.parse(readFileSync(fname).toString())
    return undefined
  }

  static store(key, value) {
    const fname = `./storage/${key}.json`
    writeFileSync(fname, JSON.stringify(value))
  }

  write(key, value) {
    this.storage.set(key, value)
    FileSessionStorage.store(key, value)
  }

  read(key) {
    const value = this.storage.get(key)
    if (value === undefined) return FileSessionStorage.load(key)
    return value
  }
}
