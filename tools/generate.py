"""Generate everything downstream of the ontology from its LinkML source (decision 6).

Writes generated/:
- owl/payments.ttl            the ontology published as OWL
- shacl/payments.shacl.ttl    the shapes that gate every load (decision 8)
- jsonschema/payments.schema.json   the extraction schema
- pydantic/payments.py        Pydantic models
- neptune/nodes/<Class>.csv   openCypher load file headers, one per concrete class
- neptune/edges/<TYPE>.csv    openCypher load file headers, one per relationship
- neptune/schema.json         label chains and relationships, for the loader and validator
- opensearch/<index>.json     settings and mappings for the entities, chunks and ontology indexes
- opensearch/ontology.ndjson  the ontology index's documents, one per class

Output is deterministic, so CI can tell when a committed file no longer matches the
ontology. Snowflake semantic views come once metrics are defined in the ontology (decision 5).

Usage:
    pip install -r tools/requirements-ontology.txt
    python tools/generate.py           # write generated/
    python tools/generate.py --check   # fail if generated/ is out of date
"""
import json
import pathlib
import sys
import warnings

from linkml.generators.jsonschemagen import JsonSchemaGenerator
from linkml.generators.owlgen import OwlSchemaGenerator
from linkml.generators.pydanticgen import PydanticGenerator
from linkml.generators.shaclgen import ShaclGenerator
from linkml_runtime.utils.schemaview import SchemaView
from rdflib import RDF, BNode, Graph, URIRef
from rdflib.collection import Collection
from rdflib.compare import to_canonical_graph

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "ontology" / "payments.yaml"
OUT = ROOT / "generated"

# Neptune's openCypher load format: https://docs.aws.amazon.com/neptune/latest/userguide/bulk-load-tutorial-format-opencypher.html
# It has no decimal type, so amounts load as Double; exact sums run in Snowflake (decision 14).
NEPTUNE_TYPES = {"datetime": "DateTime", "date": "DateTime", "decimal": "Double", "float": "Double",
                 "double": "Double", "integer": "Long", "boolean": "Bool"}
NEPTUNE_ALLOWED = {"Bool", "Byte", "Short", "Int", "Long", "Float", "Double", "String", "DateTime"}
OPENSEARCH_TYPES = {"datetime": "date", "date": "date", "decimal": "double", "float": "double",
                    "double": "double", "integer": "long", "boolean": "boolean"}
# Amazon Nova Multimodal Embeddings offers 256, 384, 1,024 or 3,072 dimensions (research notes).
# Prototype step 3 confirms the model; change it here and regenerate.
EMBEDDING_DIMENSION = 1024
IN_MEMORY = {"type": "knn_vector", "dimension": EMBEDDING_DIMENSION, "space_type": "cosinesimil",
             "method": {"name": "hnsw", "engine": "faiss"}}
# Chunks can use the cheaper S3 Vectors engine (decision 3): OpenSearch 2.19 or later, on OpenSearch Optimized instances.
IN_S3 = {"type": "knn_vector", "dimension": EMBEDDING_DIMENSION, "space_type": "cosinesimil",
         "method": {"engine": "s3vector"}}


class Ontology:
    """The parts of the schema every generator here reads, through LinkML's SchemaView."""

    def __init__(self, path):
        self.sv = SchemaView(str(path))
        self.version = self.sv.schema.version
        self.any = {n for n, c in self.sv.all_classes().items() if c.class_uri == "linkml:Any"}
        self.classes = {n: c for n, c in sorted(self.sv.all_classes().items()) if n not in self.any}
        self.concrete = [n for n, c in self.classes.items() if not c.abstract]

    def annotation(self, element, key):
        anns = element.annotations
        if not anns:
            return None
        # Declared elements hold a dict of annotations; induced slots hold a JsonObj.
        a = anns.get(key) if isinstance(anns, dict) else getattr(anns, key, None)
        return getattr(a, "value", a)

    def chain(self, name):
        return self.sv.class_ancestors(name)

    def is_relationship(self, slot):
        return slot.range in self.classes or slot.range in self.any

    def attributes(self, name):
        """A class's own and inherited attributes, in schema order, without its ID."""
        return [s for s in self.sv.class_induced_slots(name) if not s.identifier and not self.is_relationship(s)]

    def relationships(self):
        """Every relationship, from the class that declares it: (slot, from, to)."""
        out = []
        for name, cls in self.classes.items():
            for slot_name in cls.slots or []:
                slot = self.sv.induced_slot(slot_name, name)
                if self.is_relationship(slot):
                    out.append((slot, name, "any" if slot.range in self.any else slot.range))
        return sorted(out, key=lambda r: (r[0].name, r[1]))


# ---------- LinkML's own generators ----------

SH_IGNORED = URIRef("http://www.w3.org/ns/shacl#ignoredProperties")


def sort_ignored_properties(g):
    """LinkML builds sh:ignoredProperties from a Python set, so its order changes from run to
    run. SHACL reads the list as a set, so sort it."""
    for shape, head in list(g.subject_objects(SH_IGNORED)):
        items, node = [], head
        while node != RDF.nil:
            items.append(g.value(node, RDF.first))
            nxt = g.value(node, RDF.rest)
            g.remove((node, None, None))
            node = nxt
        g.remove((shape, SH_IGNORED, head))
        new = BNode()
        Collection(g, new, sorted(items, key=str))
        g.add((shape, SH_IGNORED, new))


def canonical_turtle(ttl):
    """Turtle with stable blank node names and list orders, so the same schema always gives the same file."""
    g = Graph()
    g.parse(data=ttl, format="turtle")
    sort_ignored_properties(g)
    out = Graph()
    for prefix, ns in g.namespaces():
        out.bind(prefix, ns, override=True)
    for triple in to_canonical_graph(g):
        out.add(triple)
    return out.serialize(format="turtle")


def linkml_outputs():
    path = str(SCHEMA)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        owl = OwlSchemaGenerator(
            path,
            # Enum values that point at individuals, such as FIBO's VisaNetwork, stay individuals.
            default_permissible_value_type="http://www.w3.org/2002/07/owl#NamedIndividual",
            skip_vacuous_min_zero_cardinality_axioms=True,
            skip_vacuous_local_range_axioms=True,
            consolidate_cardinality_axioms=True,
        ).serialize()
        shacl = ShaclGenerator(path).serialize()
        jsonschema = JsonSchemaGenerator(path).serialize()
        pydantic = PydanticGenerator(path).serialize()
    return {
        "owl/payments.ttl": canonical_turtle(owl),
        "shacl/payments.shacl.ttl": canonical_turtle(shacl),
        "jsonschema/payments.schema.json": jsonschema if jsonschema.endswith("\n") else jsonschema + "\n",
        "pydantic/payments.py": pydantic if pydantic.endswith("\n") else pydantic + "\n",
    }


# ---------- Neptune ----------

def neptune_type(onto, slot, where):
    if slot.multivalued:
        sys.exit(f"{where}: Neptune's openCypher load format has no list columns. Make {slot.name} single-valued, or a relationship.")
    return NEPTUNE_TYPES.get(slot.range, "String")


def edge_properties(onto, slot):
    """Properties a relationship carries, from its edge_properties annotation, such as 'auths:Long, last_seen:DateTime'."""
    spec = onto.annotation(slot, "edge_properties")
    if not spec:
        return []
    props = [p.strip() for p in spec.split(",") if p.strip()]
    for p in props:
        name, _, kind = p.partition(":")
        if not name or kind not in NEPTUNE_ALLOWED:
            sys.exit(f"slot {slot.name}: edge property '{p}' needs a Neptune type, one of {sorted(NEPTUNE_ALLOWED)}")
    return props


def neptune_outputs(onto):
    files = {}
    for name in onto.concrete:
        columns = [f"{s.name}:{neptune_type(onto, s, name)}" for s in onto.attributes(name)]
        files[f"neptune/nodes/{name}.csv"] = ",".join([":ID", ":LABEL", *columns, "ontology_version:String"]) + "\n"
    rels = onto.relationships()
    for slot, _, _ in rels:
        # Edge IDs are built from their ends and type, so reloading the same data changes nothing.
        files[f"neptune/edges/{slot.name.upper()}.csv"] = ",".join(
            [":ID", ":START_ID", ":END_ID", ":TYPE", *edge_properties(onto, slot), "ontology_version:String"]) + "\n"
    schema = {
        "ontology_version": onto.version,
        "labels": {name: onto.chain(name) for name in onto.concrete},
        "edge_id_rule": "{start_id}|{TYPE}|{end_id}",
        "relationships": [
            {"type": slot.name.upper(), "from": frm, "to": to, "multivalued": bool(slot.multivalued),
             "properties": edge_properties(onto, slot)}
            for slot, frm, to in rels
        ],
    }
    files["neptune/schema.json"] = json.dumps(schema, indent=2) + "\n"
    return files


# ---------- OpenSearch ----------

def field(onto, slot):
    if slot.name == "name":
        return {"type": "text", "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}}
    return {"type": OPENSEARCH_TYPES.get(slot.range, "keyword")}


def merge_fields(onto, classes, with_relationships):
    fields = {}
    for name in classes:
        slots = onto.sv.class_induced_slots(name)
        for s in slots:
            if s.identifier or (onto.is_relationship(s) and not with_relationships):
                continue
            f = {"type": "keyword"} if onto.is_relationship(s) else field(onto, s)
            if s.name in fields and fields[s.name] != f:
                sys.exit(f"{name}.{s.name}: indexed as {f} here but {fields[s.name]} elsewhere")
            fields[s.name] = f
    return dict(sorted(fields.items()))


BASE = {
    # The one ID rule across stores (decision 4): the Neptune ID, repeated as a field.
    "neptune_id": {"type": "keyword"},
    "class": {"type": "keyword"},
    "labels": {"type": "keyword"},
    # Who may see a document (decision 18).
    "classification": {"type": "keyword"},
    "ontology_version": {"type": "keyword"},
}


def index(properties):
    return json.dumps({"settings": {"index": {"knn": True}}, "mappings": {"properties": properties}}, indent=2) + "\n"


def opensearch_outputs(onto):
    graph = [n for n in onto.concrete if onto.annotation(onto.classes[n], "lives_in") == "graph"]
    chunks = [n for n in onto.concrete if onto.annotation(onto.classes[n], "search_index") == "chunks"]
    if not chunks:
        sys.exit("No class has search_index: chunks, so the chunks index has nothing to hold")
    entities = {**BASE, **merge_fields(onto, graph, with_relationships=False), "embedding": IN_MEMORY}
    chunk_props = {**BASE, **merge_fields(onto, chunks, with_relationships=True),
                   "text": {"type": "text"}, "embedding": IN_S3}
    ontology = {
        "class": {"type": "keyword"}, "labels": {"type": "keyword"}, "abstract": {"type": "boolean"},
        "aliases": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
        "description": {"type": "text"}, "owner": {"type": "keyword"}, "lives_in": {"type": "keyword"},
        "id_rule": {"type": "keyword"}, "close_mappings": {"type": "keyword"},
        "relationships": {"type": "keyword"}, "ontology_version": {"type": "keyword"}, "embedding": IN_MEMORY,
    }
    rels = onto.relationships()
    lines = []
    for name, cls in onto.classes.items():
        chain = onto.chain(name)
        doc = {
            "class": name, "labels": chain, "abstract": bool(cls.abstract),
            "aliases": list(cls.aliases or []), "description": " ".join((cls.description or "").split()),
            "owner": onto.annotation(cls, "owner"), "lives_in": onto.annotation(cls, "lives_in"),
            "id_rule": onto.annotation(cls, "id_rule"), "close_mappings": list(cls.close_mappings or []),
            "relationships": [f"{slot.name.upper()}>{to}" for slot, frm, to in rels if frm in chain],
            "ontology_version": onto.version,
        }
        lines.append(json.dumps({"index": {"_id": f"{onto.sv.schema.default_prefix}:{name}"}}))
        lines.append(json.dumps(doc))
    return {
        "opensearch/entities.json": index(entities),
        "opensearch/chunks.json": index(chunk_props),
        "opensearch/ontology.json": index(ontology),
        "opensearch/ontology.ndjson": "\n".join(lines) + "\n",
    }


# ---------- The readme ----------

def readme(onto, files):
    listed = "\n".join(f"- `{p}`" for p in sorted(files))
    return f"""# Generated from the ontology

Everything here is generated from `ontology/payments.yaml` (version {onto.version}) by
`tools/generate.py`. Don't edit these files: change the ontology, then run

```bash
python tools/generate.py
```

CI runs `python tools/generate.py --check` and fails when a file here no longer matches the ontology.

- `owl/`, `shacl/`, `jsonschema/`, `pydantic/`: LinkML's own generators. The RDF files are
  canonicalized, so the same schema always gives the same file.
- `neptune/`: openCypher load file headers. Node files carry every label in the class's chain
  (`:LABEL` values separated by `;`), and edge IDs follow `schema.json`'s `edge_id_rule`, so
  reloading the same data changes nothing.
- `opensearch/`: settings and mappings for the three indexes (decision 3), and the ontology
  index's documents. Vectors have {EMBEDDING_DIMENSION} dimensions; chunks use the S3 Vectors engine.

Files:

{listed}
"""


def outputs():
    onto = Ontology(SCHEMA)
    files = {**linkml_outputs(), **neptune_outputs(onto), **opensearch_outputs(onto)}
    files["README.md"] = readme(onto, files)
    return files


def main():
    check = "--check" in sys.argv[1:]
    files = outputs()
    existing = {p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file()} if OUT.exists() else set()
    stale = sorted(p for p, text in files.items() if not (OUT / p).exists() or (OUT / p).read_text() != text)
    extra = sorted(existing - set(files))
    if check:
        for p in stale:
            print(f"out of date: generated/{p}")
        for p in extra:
            print(f"no longer generated: generated/{p}")
        if stale or extra:
            sys.exit("generated/ doesn't match the ontology. Run: python tools/generate.py")
        print(f"generated/ matches the ontology: {len(files)} files")
        return
    for p in stale:
        (OUT / p).parent.mkdir(parents=True, exist_ok=True)
        (OUT / p).write_text(files[p])
    for p in extra:
        (OUT / p).unlink()
    print(f"generated/: {len(stale)} written, {len(extra)} removed, {len(files) - len(stale)} unchanged")


if __name__ == "__main__":
    main()
