import { countAddedLines, countRemovedLines } from "../src/git_logs";

describe("Testing filter by extracting the gitlogs", () => {
  test("ignores whitespace-only added lines", () => {
    const diff = `
+++ b/file.ts
+    
+\t
+   \t
`;
    expect(countAddedLines(diff)).toBe(0);
  });

  test("ignores comment-only added lines", () => {
    const diff = `
+++ b/file.ts
+// single line comment
+   // indented comment
+/* block comment start */
+ * block inner
+*/
`;
    expect(countAddedLines(diff)).toBe(0);
  });

  test("counts real code lines", () => {
    const diff = `
+++ b/file.ts
+const x = 1;
+return x;
`;
    expect(countAddedLines(diff)).toBe(2);
  });

  test("handles mixed diff correctly", () => {
    const diff = `
+++ b/file.ts
+   
+// comment
+/* block
+ * inner
+ */
+public foo(): number {
+  return 42;
+}
`;
    expect(countAddedLines(diff)).toBe(3);
  });

  test("does NOT ignore comment markers inside strings", () => {
    const diff = `
+++ b/file.ts
+const url = "http://example.com";
+const regex = /\\/\\//;
`;
    expect(countAddedLines(diff)).toBe(2);
  });

  test("counts removed lines with same filtering rules", () => {
    const diff = `
--- a/file.ts
-// removed comment
-
-public foo(): number {
-  return 42;
-}
`;
    expect(countRemovedLines(diff)).toBe(3);
  });

  test("ignores diff headers +++/--- only", () => {
    const diff = `
+++ b/file.ts
--- a/file.ts
`;
    expect(countAddedLines(diff)).toBe(0);
    expect(countRemovedLines(diff)).toBe(0);
  });

  test("does not count +++ even if it contains spaces", () => {
    const diff = `
+++ b/file.ts
++++ not a real header but starts with +++
+const x = 1;
`;
    expect(countAddedLines(diff)).toBe(1);
  });

  test("counts a line that starts with '+' inside content correctly", () => {
    const diff = `
+++ b/file.ts
+const s = "+plus";
+const t = "+++"; 
`;
    expect(countAddedLines(diff)).toBe(2);
  });

  test("keeps inline comments (code + //) because it is not comment-only", () => {
    const diff = `
+++ b/file.ts
+const x = 1; // inline comment
+return x;    // another
`;
    expect(countAddedLines(diff)).toBe(2);
  });

  test("keeps inline block comments (code + /* */) because it is not comment-only", () => {
    const diff = `
+++ b/file.ts
+const x = /* inline */ 1;
+const y = 2 /* inline */;
`;
    expect(countAddedLines(diff)).toBe(2);
  });

  test("ignores indented block comment lines", () => {
    const diff = `
+++ b/file.ts
+   /* block start */
+     * inner
+   */
+const x = 1;
`;
    expect(countAddedLines(diff)).toBe(1);
  });

  test("does NOT ignore lines that contain comment markers but do not start with them", () => {
    const diff = `
+++ b/file.ts
+const url = "http://example.com"; 
+const s = "/* not a comment */";
+const t = "*/";
`;
    expect(countAddedLines(diff)).toBe(3);
  });

  test("handles CRLF input (\\r\\n) correctly", () => {
    const diff = "+++ b/file.ts\r\n+\r\n+// c\r\n+const x = 1;\r\n";
    expect(countAddedLines(diff)).toBe(1);
  });

  test("counts removed code lines and ignores removed comment/blank", () => {
    const diff = `
--- a/file.ts
-// removed comment
-
-const x = 1;
-/* removed block */
-  * removed inner
-*/
-return x;
`;
    expect(countRemovedLines(diff)).toBe(2);
  });

  test("counts braces-only lines as code", () => {
    const diff = `
+++ b/file.ts
+{
+}
+; 
`;
    expect(countAddedLines(diff)).toBe(3);
  });

  test("does not count context lines", () => {
    const diff = `
+++ b/file.ts
 const unchanged = 1;
+const added = 2;
-const removed = 3;
`;
    expect(countAddedLines(diff)).toBe(1);
    expect(countRemovedLines(diff)).toBe(1);
  });

  test("handles a realistic hunk with @@ markers", () => {
    const diff = `
diff --git a/file.ts b/file.ts
index 123..456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-// header comment
+// header comment changed
const x = 1;
+const y = 2;
`;
    // removed: (comment-only) -> ignored => 0
    // added: +// ... -> ignored, +const remember => 1
    expect(countRemovedLines(diff)).toBe(0);
    expect(countAddedLines(diff)).toBe(1);
  });
});
