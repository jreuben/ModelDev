# JSON Structure Designer (SAPUI5 / OpenUI5)

Design-time tool to create, update and delete named JSON structures.

- **Master list**: all structures, search, **Create** (name: letters and digits only, unique ignoring case),
  **Import** / **Export** of all structures as a JSON file.
- **Detail page**: table of keys with columns *Key*, *Type*, *Default Value*, *Array* (multi-value).
  - Type = any OData EDM primitive type or another JSON structure.
  - When a structure is chosen as a type, a tree icon appears next to it; it shows the nested layout
    of that structure and can open it.
  - When *Array* is checked, the default value becomes a MultiInput: type a value and press Enter to add it
    as a token (checked against the EDM type, no duplicates), remove tokens with their x.
    Saved/exported as `"defaultValue": ["a", "b"]`; unchecking *Array* keeps the first value.
  - **Add Row**, per-row delete and **Delete Selected**.
  - Header actions: edit (rename/description; references in other structures follow the rename),
    show JSON (definition and sample instance), delete (blocked while other structures use it).

Data is saved automatically in the browser's localStorage (key `modeldev.jsonStructures`).
Use Export to keep a file copy. On first start, sample structures (Address, Customer, Order) are loaded.

Run: open `http://localhost:8080/ClaudeCode/ModelDev/index.html` with Tomcat running
(UI5 is loaded from the OpenUI5 CDN).
