// macOS 26+ 文档结构识别（RecognizeDocumentsRequest）：段落 + 表格
//
// 编译：swiftc -O vision_doc.swift -o vision_doc
// 用法：./vision_doc --out <目录> <图片>
// 输出：<文件名>.doc.json，含 paragraphs[]（文本+坐标）与 tables[]（二维单元格）

import Foundation
import Vision
import AppKit
import CoreGraphics

func loadImage(_ path: String) -> CGImage? {
    guard let image = NSImage(contentsOfFile: path) else { return nil }
    return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
}

struct Paragraph: Codable {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

struct TableOut: Codable {
    let rows: [[String]]
}

struct DocOut: Codable {
    let file: String
    let paragraphs: [Paragraph]
    let tables: [TableOut]
    let elapsedMs: Int
}

let args = CommandLine.arguments
var outDir: URL?
var files: [String] = []
var index = 1
while index < args.count {
    if args[index] == "--out", index + 1 < args.count {
        outDir = URL(fileURLWithPath: args[index + 1])
        index += 2
    } else {
        files.append(args[index])
        index += 1
    }
}
guard let outDir else {
    FileHandle.standardError.write("usage: vision_doc --out <dir> <images...>\n".data(using: .utf8)!)
    exit(2)
}
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let semaphore = DispatchSemaphore(value: 0)
Task {
    for path in files {
        let url = URL(fileURLWithPath: path)
        let stem = url.deletingPathExtension().lastPathComponent
        let started = Date()
        guard let cg = loadImage(path) else {
            FileHandle.standardError.write("skip: \(path)\n".data(using: .utf8)!)
            continue
        }
        var request = RecognizeDocumentsRequest()
        request.textRecognitionOptions.recognitionLanguages = [Locale.Language(identifier: "zh-Hans")]
        request.textRecognitionOptions.useLanguageCorrection = true
        request.textRecognitionOptions.automaticallyDetectLanguage = true

        do {
            let observations = try await request.perform(on: cg)
            var paragraphs: [Paragraph] = []
            var tables: [TableOut] = []
            for observation in observations {
                let container = observation.document
                for paragraph in container.paragraphs {
                    let region = paragraph.boundingRegion
                    paragraphs.append(Paragraph(
                        text: paragraph.transcript,
                        x: Double(region.boundingBox.origin.x),
                        y: Double(region.boundingBox.origin.y),
                        w: Double(region.boundingBox.width),
                        h: Double(region.boundingBox.height)
                    ))
                }
                for table in container.tables {
                    tables.append(TableOut(rows: table.rows.map { row in
                        row.map { $0.content.text.transcript }
                    }))
                }
            }
            let out = DocOut(file: url.lastPathComponent, paragraphs: paragraphs, tables: tables,
                             elapsedMs: Int(Date().timeIntervalSince(started) * 1000))
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
            try encoder.encode(out).write(to: outDir.appendingPathComponent("\(stem).doc.json"))
            print("\(stem): paragraphs=\(paragraphs.count) tables=\(tables.count) \(out.elapsedMs)ms")
        } catch {
            FileHandle.standardError.write("failed \(path): \(error)\n".data(using: .utf8)!)
        }
    }
    semaphore.signal()
}
semaphore.wait()
