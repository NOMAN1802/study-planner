// Slices pages of a scanned PDF into a new, smaller PDF (macOS, PDFKit).
//   pdf-slice <book.pdf> <out.pdf> <ranges e.g. 71-78,133-142> <widthPx> <jpegQuality>
// Each page is re-encoded as a JPEG of the given width so the slice stays small.

import PDFKit
import AppKit
let a = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let pages = a[3].split(separator: ",").flatMap { r -> [Int] in
  let p = r.split(separator: "-").map { Int($0)! }; return p.count == 2 ? Array(p[0]...p[1]) : [p[0]] }
let width = CGFloat(Double(a[4])!), q = Double(a[5])!
let out = PDFDocument()
for n in pages {
  autoreleasepool {
    let page = doc.page(at: n - 1)!
    let b = page.bounds(for: .mediaBox)
    let img = page.thumbnail(of: NSSize(width: width, height: width * b.height / b.width), for: .mediaBox)
    let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
    let jpg = rep.representation(using: .jpeg, properties: [.compressionFactor: q])!
    let small = NSImage(data: jpg)!
    small.size = NSSize(width: b.width, height: b.height)
    out.insert(PDFPage(image: small)!, at: out.pageCount)
  }
}
out.write(to: URL(fileURLWithPath: a[2]))
