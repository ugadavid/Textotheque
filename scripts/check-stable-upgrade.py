"""Compare two closed, explicitly supplied snapshots from the 052 qualification."""
import argparse
import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path


def load(directory, name):
    return json.loads((directory / name).read_text(encoding="utf-8-sig"))


def business(directory):
    file = directory / "textotheque.sqlite"
    with closing(sqlite3.connect(file.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        assert db.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert db.execute("PRAGMA application_id").fetchone() == (0x5445584F,)
        assert db.execute("PRAGMA user_version").fetchone() == (5,)
        tables = {}
        for table in ("documents", "folders", "saved_searches", "saved_search_folders", "saved_search_statuses"):
            cursor = db.execute(f"SELECT * FROM {table} ORDER BY rowid")
            columns = [col[0] for col in cursor.description]
            tables[table] = [dict(zip(columns, row)) for row in cursor]
        for row in tables["documents"]:
            del row["last_opened_at"]
        return tables


def history(directory):
    registry = load(directory, "library-history.json")
    assert len(registry["libraries"]) == 2
    for entry in registry["libraries"]:
        del entry["lastOpenedAt"]
    return registry


def windows(directory, version):
    inventory = load(directory, "windows.json")
    assert inventory["programVersion"] == version
    app, = inventory["installed"]
    assert app["DisplayVersion"] == version and app["PSChildName"] == "Textotheque"
    assert app["InstallLocation"] == inventory["root"]
    link, = inventory["links"]
    assert Path(link["target"]) == Path(inventory["root"]) / "Textotheque.exe"
    assert "app-" + version in inventory["files"]
    assert "Local Storage" in inventory["contents"]
    return inventory["profile"], inventory["profileCreated"], link, inventory["root"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    args = parser.parse_args()
    expected = business(args.before)
    assert len(expected["documents"]) == 4 and len(expected["folders"]) == 3
    assert len(expected["saved_searches"]) == 1
    assert any(d["special_role"] == "todo" for d in expected["documents"])
    assert any(d["deleted_at"] for d in expected["documents"])
    assert business(args.after) == expected, "Données métier différentes"
    assert history(args.before) == history(args.after), "Registre différent"
    assert windows(args.before, "0.1.28") == windows(args.after, "0.1.29"), "Identité Windows différente"
    second = "Qualification-052-B.sqlite"
    assert (args.before / second).read_bytes() == (args.after / second).read_bytes()
    for directory in (args.before, args.after):
        file = directory / "textotheque.sqlite"
        print(directory.name, file.stat().st_size, hashlib.sha256(file.read_bytes()).hexdigest())
    print("OK : versions, raccourci, profil, registre, dossiers, documents et recherches.")


if __name__ == "__main__":
    main()
