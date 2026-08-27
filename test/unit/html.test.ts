/** Taking words out of the markup a wiki page renders. */

import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  fieldName,
  fieldValue,
  links,
  tableRows,
  text,
} from "../../src/imslp/html.js";

describe("entities", () => {
  it("decodes the named ones a rendering uses", () => {
    expect(decodeEntities("Fr&amp;d&quot;ric&nbsp;&lt;x&gt;&apos;")).toBe("Fr&d\"ric <x>'");
  });

  it("decodes numeric ones, decimal and hexadecimal", () => {
    // A page separates a statement from its restrictions with &#160;, which is
    // a non-breaking space and stays one here: the collapsing of spaces belongs
    // to the reading of a whole fragment.
    expect(decodeEntities("&#160;&#xe9;&#233;")).toBe("\u00a0éé");
  });

  it("leaves alone what is no entity", () => {
    expect(decodeEntities("&nope; &#x110000;")).toBe("&nope; &#x110000;");
  });
});

describe("the words of a fragment", () => {
  it("drops the markup and keeps the lines", () => {
    expect(text("<p>One<br />Two</p>")).toBe("One\nTwo");
  });

  it("drops the controls a page prints for its editors", () => {
    expect(text('Public Domain<span class="noanon"> [tag/del]</span>')).toBe("Public Domain");
  });

  it("drops a script the page carries", () => {
    expect(text("<div>Value<script>JG={};</script></div>")).toBe("Value");
  });
});

describe("the name of a field", () => {
  it("keeps the spelled-out label and drops the narrow one", () => {
    expect(
      fieldName(
        '<span class="mh555">Opus/Catalogue Number</span><span class="ms555">Op./Cat. No.</span>',
      ),
    ).toBe("Opus/Catalogue Number");
  });

  it("reads the two spellings of a publisher label as one name", () => {
    expect(
      fieldName('Pub<span class="mh555">lisher</span><span class="ms555">.</span> Info.'),
    ).toBe("Publisher Info");
    expect(fieldName("Publisher Info.")).toBe("Publisher Info");
  });
});

describe("the value of a cell", () => {
  it("reads an empty cell as absent", () => {
    expect(fieldValue("  \n ")).toBeNull();
  });

  it("drops the editor-only note printed beside a value", () => {
    expect(
      fieldValue('None <small>[<span class="icatassign">force assignment</span>]</small>'),
    ).toBe("None");
  });
});

describe("the rows of a table", () => {
  it("reads each labelled row in the order the page lists them", () => {
    const rows = tableRows(
      "<tr><th>Key\n</th><td>B minor\n</td></tr><tr><th>\n</th><td>x</td></tr>",
    );

    expect(rows).toEqual([{ name: "Key", html: "B minor\n", value: "B minor" }]);
  });
});

describe("the links of a cell", () => {
  it("reads each with the text it was printed as", () => {
    expect(links('<a href="/wiki/A%20B" title="A B">A B</a>')).toEqual([
      { href: "/wiki/A%20B", label: "A B" },
    ]);
  });
});
