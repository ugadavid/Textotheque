"""Compare the first Windows icon group in each EXE with the canonical ICO."""
import argparse
import ctypes
from ctypes import wintypes as w
from pathlib import Path
import struct


def ico_images(data):
    reserved, kind, count = struct.unpack_from("<3H", data)
    if (reserved, kind) != (0, 1) or not count:
        raise ValueError("Invalid ICO header")
    images = []
    for i in range(count):
        size, offset = struct.unpack_from("<II", data, 6 + 16*i + 8)
        images.append(data[offset:offset + size])
    return images


def first_icon_group(exe):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    pointer = ctypes.c_void_p
    callback = ctypes.WINFUNCTYPE(w.BOOL, pointer, pointer, pointer, pointer)
    def api(name, result, *args):
        fn = getattr(kernel, name)
        fn.argtypes, fn.restype = args, result
        return fn
    load = api("LoadLibraryExW", pointer, w.LPCWSTR, pointer, w.DWORD)
    free = api("FreeLibrary", w.BOOL, pointer)
    names = api("EnumResourceNamesW", w.BOOL, pointer, pointer, callback, pointer)
    find = api("FindResourceW", pointer, pointer, pointer, pointer)
    size = api("SizeofResource", w.DWORD, pointer, pointer)
    resource = api("LoadResource", pointer, pointer, pointer)
    lock = api("LockResource", pointer, pointer)
    module = load(str(exe.resolve(strict=True)), None, 2)  # Load as data only.
    if not module:
        raise ctypes.WinError(ctypes.get_last_error())
    def read(kind, name):
        entry = find(module, name, kind)
        if not entry:
            raise ctypes.WinError(ctypes.get_last_error())
        return ctypes.string_at(lock(resource(module, entry)), size(module, entry))
    try:
        groups = []
        @callback
        def collect(_, kind, name, context):
            groups.append(name if name <= 65535 else ctypes.c_wchar_p(ctypes.wstring_at(name)))
            return True
        if not names(module, 14, collect, None):
            raise ctypes.WinError(ctypes.get_last_error())
        group = read(14, groups[0])
        count = struct.unpack_from("<H", group, 4)[0]
        return [read(3, struct.unpack_from("<H", group, 6 + 14*i + 12)[0]) for i in range(count)]
    finally:
        free(module)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("executables", nargs="+", type=Path)
    args = parser.parse_args()
    expected = ico_images((Path(__file__).resolve().parents[1] / "assets/branding/textotheque.ico").read_bytes())
    for exe in args.executables:
        actual = first_icon_group(exe)
        if sorted(actual) != sorted(expected):
            raise SystemExit(f"{exe}: icon mismatch ({len(actual)} entries, expected {len(expected)})")
        print(f"{exe}: {len(actual)} matching Windows icon resources")
