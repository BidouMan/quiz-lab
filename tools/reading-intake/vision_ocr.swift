// macOS 自带 Vision 文字识别批处理：图片 / PDF 页 -> 逐行 JSON + 纯文本
//
// 编译：swiftc -O vision_ocr.swift -o vision_ocr
// 用法：./vision_ocr --out <目录> <图片或PDF>...
//       ./vision_ocr --out <目录> --langs zh-Hans,en-US <文件>...
//
// 输出：<文件名>.vision.json（含逐行文本、置信度、归一化坐标）
//      <文件名>.vision.txt（按阅读顺序拼接的纯文本，每行一条 observation）

import Foundation
import Vision
import AppKit
import CoreGraphics

struct Line: Codable {
    let text: String
    let confidence: Double
    // Vision 归一化坐标：左下角为原点，y 向上
    let x: Double
    let y: Double
    let w: Double
    let h: Double
    let page: Int
    /// 该页采用的旋转角度（扫描件自动纠正后的方向）
    let rotation: Int
}

struct DocResult: Codable {
    let file: String
    let pages: Int
    let elapsedMs: Int
    let lines: [Line]
    let texts: [String]
}

func renderPDF(_ url: URL, scale: CGFloat) -> [CGImage] {
    guard let doc = CGPDFDocument(url as CFURL) else { return [] }
    var images: [CGImage] = []
    for index in 1...doc.numberOfPages {
        guard let page = doc.page(at: index) else { continue }
        let box = page.getBoxRect(.mediaBox)
        let width = Int(box.width * scale)
        let height = Int(box.height * scale)
        guard let ctx = CGContext(
            data: nil, width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
        ) else { continue }
        ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        ctx.scaleBy(x: scale, y: scale)
        ctx.drawPDFPage(page)
        if let image = ctx.makeImage() { images.append(image) }
    }
    return images
}

func recognizeRaw(_ image: CGImage, langs: [String], page: Int, rotation: Int) -> [Line] {
    let request = VNRecognizeTextRequest()
    // 实测：macOS 27 默认 revision=3 对中文印刷体反而更差且慢 3–6 倍，固定用 revision 2
    request.revision = 2
    request.recognitionLevel = .accurate
    request.recognitionLanguages = langs
    request.usesLanguageCorrection = true
    // 中文版面常有竖排/多栏，保留最小文本高度，避免漏掉小字
    request.minimumTextHeight = 0.0

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        FileHandle.standardError.write("Vision error: \(error)\n".data(using: .utf8)!)
        return []
    }
    guard let observations = request.results else { return [] }
    var lines: [Line] = []
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let box = observation.boundingBox
        lines.append(Line(
            text: candidate.string,
            confidence: Double(candidate.confidence),
            x: Double(box.origin.x),
            y: Double(box.origin.y),
            w: Double(box.size.width),
            h: Double(box.size.height),
            page: page,
            rotation: rotation
        ))
    }
    return lines
}

/// 把图片顺时针旋转指定角度（0/90/180/270）
func rotated(_ image: CGImage, degrees: Int) -> CGImage {
    if degrees == 0 { return image }
    let radians = CGFloat(degrees) * .pi / 180
    let w = CGFloat(image.width)
    let h = CGFloat(image.height)
    let newW = degrees % 180 == 0 ? image.width : image.height
    let newH = degrees % 180 == 0 ? image.height : image.width
    guard let ctx = CGContext(
        data: nil, width: newW, height: newH,
        bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else { return image }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: newW, height: newH))
    ctx.translateBy(x: CGFloat(newW) / 2, y: CGFloat(newH) / 2)
    ctx.rotate(by: radians)
    ctx.draw(image, in: CGRect(x: -w / 2, y: -h / 2, width: w, height: h))
    return ctx.makeImage() ?? image
}

func cjkCount(_ text: String) -> Int {
    text.unicodeScalars.filter { (0x4E00...0x9FFF).contains(Int($0.value)) }.count
}

/// 扫描件常见整页旋转。逐角度试识别，用「汉字数 × 置信度」打分选最优方向。
func recognize(_ image: CGImage, langs: [String], page: Int, autoRotate: Bool) -> (lines: [Line], degrees: Int) {
    var best: (lines: [Line], degrees: Int, score: Double) = ([], 0, -1)
    let candidates = autoRotate ? [0, 90, 180, 270] : [0]
    for degrees in candidates {
        let lines = recognizeRaw(rotated(image, degrees: degrees), langs: langs, page: page, rotation: degrees)
        let score = lines.reduce(0.0) { $0 + Double(cjkCount($1.text)) * $1.confidence }
        if score > best.score { best = (lines, degrees, score) }
    }
    return (best.lines, best.degrees)
}

// 阅读顺序：先上后下（Vision 的 y 轴向上，故取 -y），同一行内先左后右
func readingOrder(_ lines: [Line]) -> [Line] {
    let tolerance = 0.015
    let sorted = lines.sorted { a, b in
        if abs(a.y - b.y) > tolerance { return a.y > b.y }
        return a.x < b.x
    }
    return sorted
}

let args = CommandLine.arguments
var outDir: URL?
var langs = ["zh-Hans", "en-US"]
var autoRotate = false
var pdfScale: CGFloat = 4.0
var files: [String] = []
var i = 1
while i < args.count {
    switch args[i] {
    case "--out":
        i += 1
        if i < args.count { outDir = URL(fileURLWithPath: args[i]) }
    case "--langs":
        i += 1
        if i < args.count { langs = args[i].split(separator: ",").map(String.init) }
    case "--no-rotate":
        autoRotate = false
    case "--auto-rotate":
        autoRotate = true
    case "--scale":
        i += 1
        if i < args.count { pdfScale = CGFloat(Double(args[i]) ?? 4.0) }
    default:
        files.append(args[i])
    }
    i += 1
}

guard let outDir else {
    FileHandle.standardError.write("usage: vision_ocr --out <dir> [--langs zh-Hans,en-US] <files...>\n".data(using: .utf8)!)
    exit(2)
}
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let started = Date()
for path in files {
    let url = URL(fileURLWithPath: path)
    let stem = url.deletingPathExtension().lastPathComponent
    let fileStart = Date()
    var images: [CGImage]
    if url.pathExtension.lowercased() == "pdf" {
        images = renderPDF(url, scale: pdfScale)
    } else if let image = NSImage(contentsOf: url),
              let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        images = [cg]
    } else {
        FileHandle.standardError.write("skip unreadable: \(path)\n".data(using: .utf8)!)
        continue
    }

    var all: [Line] = []
    var rotations: [Int] = []
    for (index, image) in images.enumerated() {
        let (lines, degrees) = recognize(image, langs: langs, page: index + 1, autoRotate: autoRotate)
        all.append(contentsOf: lines)
        rotations.append(degrees)
    }
    let ordered = readingOrder(all)
    let result = DocResult(
        file: url.lastPathComponent,
        pages: images.count,
        elapsedMs: Int(Date().timeIntervalSince(fileStart) * 1000),
        lines: ordered,
        texts: ordered.map { $0.text }
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
    let jsonData = try! encoder.encode(result)
    try! jsonData.write(to: outDir.appendingPathComponent("\(stem).vision.json"))
    try! result.texts.joined(separator: "\n").write(
        to: outDir.appendingPathComponent("\(stem).vision.txt"),
        atomically: true, encoding: .utf8
    )
    let avgConf = ordered.isEmpty ? 0 : ordered.map { $0.confidence }.reduce(0, +) / Double(ordered.count)
    print("\(stem): pages=\(images.count) lines=\(ordered.count) avgConf=\(String(format: "%.3f", avgConf)) rot=\(rotations.map(String.init).joined(separator: ",")) \(result.elapsedMs)ms")
}

print("total \(Int(Date().timeIntervalSince(started) * 1000))ms")
