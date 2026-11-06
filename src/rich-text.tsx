import Highlight from "@tiptap/extension-highlight";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

/** Simple page editor. The server cleans what's saved, so only this formatting can reach the shop. */
export function RichText({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, link: { openOnClick: false, protocols: ["https", "mailto", "tel"] } }), Highlight.configure({ HTMLAttributes: { class: "policy-confirm" } })],
    content: value,
    editorProps: { attributes: { "aria-label": label, class: "rich-text-area" } },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });
  // Follows Undo, Reset and switching pages, without disturbing normal typing.
  useEffect(() => { if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false }); }, [editor, value]);
  const active = useEditorState({ editor, selector: ({ editor: current }) => current ? { bold: current.isActive("bold"), italic: current.isActive("italic"), h2: current.isActive("heading", { level: 2 }), h3: current.isActive("heading", { level: 3 }), bullets: current.isActive("bulletList"), numbers: current.isActive("orderedList"), link: current.isActive("link") } : null });
  if (!editor) return null;
  const button = (text: string, on: boolean | undefined, run: () => void) => <button type="button" className={on ? "selected" : ""} aria-pressed={Boolean(on)} onMouseDown={event => event.preventDefault()} onClick={run}>{text}</button>;
  function setLink() {
    const current = editor?.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link address (https://…, or leave empty to remove)", current ?? "https://");
    if (href === null) return;
    if (!href || href === "https://") editor?.chain().focus().unsetLink().run();
    else editor?.chain().focus().setLink({ href }).run();
  }
  return <div className="rich-text">
    <div className="rich-text-tools" role="toolbar" aria-label="Formatting">
      {button("Bold", active?.bold, () => editor.chain().focus().toggleBold().run())}
      {button("Italic", active?.italic, () => editor.chain().focus().toggleItalic().run())}
      {button("Heading", active?.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {button("Small heading", active?.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      {button("Bullets", active?.bullets, () => editor.chain().focus().toggleBulletList().run())}
      {button("Numbers", active?.numbers, () => editor.chain().focus().toggleOrderedList().run())}
      {button("Link", active?.link, setLink)}
    </div>
    <EditorContent editor={editor} />
  </div>;
}
