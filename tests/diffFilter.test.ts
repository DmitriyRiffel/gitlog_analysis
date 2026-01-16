import {
  countAddedLines,
  countRemovedLines,
  countCodeChanges,
} from "../src/git_logs";

describe("Testing filter by extracting the gitlogs", () => {
  test("ignores whitespace-only added lines", () => {
    const diff = `
+++ b/file.ts
+    
+\t
+   \t
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
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
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
  });

  test("counts real code lines", () => {
    const diff = `
+++ b/file.ts
+const x = 1;
+return x;
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(2);
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
    expect(countCodeChanges(diff).sourceInsertions).toBe(3);
  });

  test("does NOT ignore comment markers inside strings", () => {
    const diff = `
+++ b/file.ts
+const url = "http://example.com";
+const regex = /\\/\\//;
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(2);
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
    expect(countCodeChanges(diff).sourceDeletions).toBe(3);
  });

  test("ignores diff headers +++/--- only", () => {
    const diff = `
+++ b/file.ts
--- a/file.ts
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
  });

  test("does not count +++ even if it contains spaces", () => {
    const diff = `
+++ b/file.ts
++++ not a real header but starts with +++
+const x = 1;
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(1);
  });

  test("counts a line that starts with '+' inside content correctly", () => {
    const diff = `
+++ b/file.ts
+const s = "+plus";
+const t = "+++"; 
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(2);
  });

  test("keeps inline comments (code + //) because it is not comment-only", () => {
    const diff = `
+++ b/file.ts
+const x = 1; // inline comment
+return x;    // another
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(2);
  });

  test("keeps inline block comments (code + /* */) because it is not comment-only", () => {
    const diff = `
+++ b/file.ts
+const x = /* inline */ 1;
+const y = 2 /* inline */;
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(2);
  });

  test("ignores indented block comment lines", () => {
    const diff = `
+++ b/file.ts
+   /* block start */
+     * inner
+   */
+const x = 1;
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(1);
  });

  test("does NOT ignore lines that contain comment markers but do not start with them", () => {
    const diff = `
+++ b/file.ts
+const url = "http://example.com"; 
+const s = "/* not a comment */";
+const t = "*/";
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(3);
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
    expect(countCodeChanges(diff).sourceDeletions).toBe(2);
  });

  test("counts braces-only lines as code", () => {
    const diff = `
+++ b/file.ts
+{
+}
+; 
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(3);
  });

  test("does not count context lines", () => {
    const diff = `
+++ b/file.ts
 const unchanged = 1;
+const added = 2;
-const removed = 3;
`;
    expect(countCodeChanges(diff).sourceInsertions).toBe(1);
    expect(countCodeChanges(diff).sourceDeletions).toBe(1);
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
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(1);
  });

  test("ignores inline-comment-only change (code unchanged, only // added)", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return Math.min(...this.noten);
+return Math.min(...this.noten); // niedrigste note
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
  });

  test("ignores inline-comment-only change (only // removed)", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return Math.min(...this.noten); // niedrigste note
+return Math.min(...this.noten);
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
  });

  test("ignores inline-block-comment-only change (/* */ added)", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return x + 1;
+return x + 1 /* random comment */;
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
  });

  test("ignores inline-block-comment-only change (/* */ removed)", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return x + 1 /* random comment */;
+return x + 1;
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
  });

  test("does NOT ignore if actual code changed plus inline comment", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return Math.min(...this.noten);
+return Math.max(...this.noten); // changed min -> max
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(1);
    expect(countCodeChanges(diff).sourceInsertions).toBe(1);
  });

  test("does NOT ignore if whitespace-only change but line is paired", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return  x  +  1;
+return x + 1; // fmt
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
  });

  test("handles multiple inline-comment-only pairs in one diff", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return a + b;
+return a + b; // sum
-return foo();
+return foo(); // call
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
    expect(countCodeChanges(diff).commentDeletions).toBe(0);
    expect(countCodeChanges(diff).commentInsertions).toBe(2);
  });

  test("handles multiple inline-comment-only pairs in one diff", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return a + b; // sum
+return a + b;
-return foo(); // call
+return foo(); 
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
    expect(countCodeChanges(diff).commentDeletions).toBe(2);
    expect(countCodeChanges(diff).commentInsertions).toBe(0);
  });

  test("handles single change in inline-comment", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return a + b; // sum
+return a + b; // sum (geaendert)
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
    expect(countCodeChanges(diff).commentDeletions).toBe(1);
    expect(countCodeChanges(diff).commentInsertions).toBe(1);
  });

  test("does not treat non-adjacent -/+ as a pair", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return a + b;
 const unchanged = 1;
+return a + b; // sum
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(1);
    expect(countCodeChanges(diff).sourceInsertions).toBe(1);
  });

  test("ignores comment-only change even when both sides are comments", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-// old comment
+// new comment
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
    expect(countCodeChanges(diff).commentDeletions).toBe(1);
    expect(countCodeChanges(diff).commentInsertions).toBe(1);
  });

  test("keeps changes when code is removed and replaced by comment-only", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-return doWork();
+// removed work
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(1);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
    expect(countCodeChanges(diff).commentInsertions).toBe(1);
    expect(countCodeChanges(diff).commentDeletions).toBe(0);
  });

  test("keeps changes when comment-only is removed and replaced by code", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-// todo
+return doWork();
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(1);
  });

  test("", () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
-         // Bu metod, kaydedilen not sayısını döndürmeli.
+
`;
    expect(countCodeChanges(diff).sourceDeletions).toBe(0);
    expect(countCodeChanges(diff).sourceInsertions).toBe(0);
    expect(countCodeChanges(diff).commentInsertions).toBe(0);
    expect(countCodeChanges(diff).commentDeletions).toBe(1);
  });
});
