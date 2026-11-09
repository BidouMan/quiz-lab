import { writeFileSync } from 'node:fs'
import { READING_BANK } from '../../../src/data/chinese/readings/index.ts'

const rows = READING_BANK.map((reading) => ({
  id: reading.id,
  title: reading.title,
  theme: reading.theme,
  paragraphs: reading.paragraphs,
  sources: reading.sources,
  skills: reading.skills ?? null,
  difficulty: reading.difficulty ?? null,
  questions: reading.questions.map((question) => ({
    type: question.type,
    stem: question.stem,
    skill: question.skill ?? null,
    origin: question.origin?.action ?? null,
  })),
}))
writeFileSync(
  'tools/reading-intake/work/bank44.json',
  JSON.stringify(rows, null, 2),
)
console.log('bank44.json', rows.length)
