"""
The Glas logo, rendered in 3D with Blender (5.2+). A rounded hexagon tile whose top surface is a
height field: three swirling arms (bulb ends, narrow necks) carved as nested grooves at equal
spacing, after the GlasIntelligence mark.

The app uses the "vivid" variant, rendered at 1024 px with 128 samples, cropped to the tile and
exported as client/src/assets/glas-mark-192.png (192 px) and public/favicon.png (256 px):

  blender -b -P scripts/brand/glas_logo.py -- vivid out.png 1024 128 800
"""
import math
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
VARIANT = argv[0] if argv else "vivid"
OUT = argv[1] if len(argv) > 1 else "//glas_logo2.png"
SIZE = int(argv[2]) if len(argv) > 2 else 1024
SAMPLES = int(argv[3]) if len(argv) > 3 else 128
GRID = int(argv[4]) if len(argv) > 4 else 700

# tile gradient (light corner, dark corner), groove floors outer -> inner, tile roughness
VARIANTS = {
    "vivid": ((0.62, 0.95, 0.32), (0.08, 0.55, 0.18),
              [(0.16, 0.70, 0.12), (0.07, 0.52, 0.08), (0.03, 0.36, 0.05), (0.012, 0.22, 0.03), (0.004, 0.11, 0.015)], 0.18),
    "mint": ((0.55, 0.96, 0.62), (0.10, 0.62, 0.30),
             [(0.12, 0.66, 0.30), (0.05, 0.48, 0.20), (0.02, 0.33, 0.13), (0.008, 0.20, 0.08), (0.003, 0.10, 0.04)], 0.22),
    "deep": ((0.20, 0.78, 0.30), (0.02, 0.30, 0.10),
             [(0.40, 0.92, 0.25), (0.20, 0.75, 0.15), (0.08, 0.55, 0.10), (0.03, 0.36, 0.06), (0.01, 0.20, 0.03)], 0.2),
}
LIGHT, DARK, FLOORS, ROUGH = VARIANTS[VARIANT]

HEX_R, HEX_CORNER, THICK = 1.0, 0.13, 0.34
RIM_R = 0.075                 # radius of the rolled top edge
ARM_LEN, SWIRL = 0.56, 1.1   # arm length and how far it curls (radians)
NECK_W, BULB_W = 0.12, 0.25 # arm half-width at the centre and at the bulb
GROOVES = 5                   # number of groove levels
GROOVE_GAP = 0.04            # wall-to-wall spacing
STEP = 0.042                  # depth per level
SOFT = 0.009                  # wall softness (half-width of the smooth step)


def arm_circles():
    """Discs along each curling arm; their union is the shape."""
    cs = []
    for k in range(3):
        base = math.pi / 2 + k * 2 * math.pi / 3
        for i in range(60):
            s = i / 59
            r = ARM_LEN * s
            a = base + SWIRL * s ** 1.4
            w = NECK_W + (BULB_W - NECK_W) * s ** 2.2
            cs.append((r * math.cos(a), r * math.sin(a), w))
    return np.array(cs)


def shape_sdf(x, y, circles):
    d = np.full(x.shape, 1e9)
    k = 0.03  # smooth union radius, rounds the neck joins
    for cx, cy, w in circles:
        di = np.hypot(x - cx, y - cy) - w
        h = np.clip(0.5 + 0.5 * (d - di) / k, 0, 1)
        d = d * (1 - h) + di * h - k * h * (1 - h)
    return d


def hex_inset(x, y):
    """Distance inside the rounded hexagon (positive inside)."""
    inner = HEX_R * math.cos(math.pi / 6) - HEX_CORNER
    q = np.full(x.shape, -1e9)
    for k in range(6):
        a = k * math.pi / 3
        q = np.maximum(q, x * math.cos(a) + y * math.sin(a))
    # corner rounding via a rounded-polygon approximation
    return inner + HEX_CORNER - q - HEX_CORNER * 0.0


def smoothstep(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def heights(x, y):
    circles = arm_circles()
    d = shape_sdf(x, y, circles)
    level = np.zeros(x.shape)
    for g in range(GROOVES):
        edge = -g * GROOVE_GAP
        level += 1 - smoothstep(edge - SOFT, edge + SOFT, d)
    z = -STEP * level
    inset = hex_inset(x, y)
    roll = np.where(inset < RIM_R, RIM_R - np.sqrt(np.clip(RIM_R ** 2 - (RIM_R - np.clip(inset, 0, None)) ** 2, 0, None)), 0)
    return z - roll, level


def build():
    n = GRID
    lin = np.linspace(-1.02, 1.02, n)
    X, Y = np.meshgrid(lin, lin)
    Z, L = heights(X, Y)

    # A watertight block: height-field top, flat bottom, four side strips. Built by hand because
    # Solidify offsets along normals and folds through itself in the steep, deep pits.
    top_v = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1)
    bot_v = np.stack([X.ravel(), Y.ravel(), np.full(n * n, -THICK)], axis=1)
    verts = np.concatenate([top_v, bot_v])
    idx = np.arange(n * n).reshape(n, n)
    b = idx + n * n
    top_q = np.stack([idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, 1:].ravel(), idx[1:, :-1].ravel()], axis=1)
    bot_q = np.stack([b[:-1, :-1].ravel(), b[1:, :-1].ravel(), b[1:, 1:].ravel(), b[:-1, 1:].ravel()], axis=1)
    ring = np.concatenate([idx[0, :], idx[1:, -1], idx[-1, -2::-1], idx[-2:0:-1, 0]])
    nxt = np.roll(ring, -1)
    side_q = np.stack([nxt, ring, ring + n * n, nxt + n * n], axis=1)
    quads = np.concatenate([top_q, bot_q, side_q])

    mesh = bpy.data.meshes.new("Surface")
    mesh.vertices.add(len(verts))
    mesh.vertices.foreach_set("co", verts.ravel().astype(np.float32))
    mesh.loops.add(quads.size)
    mesh.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    mesh.polygons.add(len(quads))
    mesh.polygons.foreach_set("loop_start", (np.arange(len(quads)) * 4).astype(np.int32))
    mesh.polygons.foreach_set("loop_total", np.full(len(quads), 4, dtype=np.int32))
    mesh.update()

    # Per-face groove level -> material index (0 = tile top, 1.. = floors).
    face_level = np.concatenate([L[:-1, :-1].ravel(), np.zeros(len(bot_q) + len(side_q))])
    mesh.polygons.foreach_set("material_index", np.clip(np.rint(face_level).astype(np.int32), 0, GROOVES))
    mesh.polygons.foreach_set("use_smooth", np.concatenate([np.ones(len(top_q), dtype=bool), np.zeros(len(bot_q) + len(side_q), dtype=bool)]))
    mesh.validate()
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    surf = bpy.data.objects.new("Surface", mesh)
    bpy.context.collection.objects.link(surf)

    # Clip to the rounded hexagon.
    import bmesh
    hexmesh = bpy.data.meshes.new("Hex")
    bm = bmesh.new()
    pts = []
    inner = HEX_R - HEX_CORNER / math.cos(math.pi / 6)
    for k in range(6):
        c = math.pi / 2 + k * math.pi / 3
        cx, cy = inner * math.cos(c), inner * math.sin(c)
        for i in range(13):
            a = c - math.pi / 6 + (math.pi / 3) * i / 12
            pts.append((cx + HEX_CORNER * math.cos(a), cy + HEX_CORNER * math.sin(a)))
    top = [bm.verts.new((px, py, 0.3)) for px, py in pts]
    f = bm.faces.new(top)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, verts=[g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)], vec=(0, 0, -1.0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(hexmesh)
    bm.free()
    hexobj = bpy.data.objects.new("Hex", hexmesh)
    bpy.context.collection.objects.link(hexobj)
    hexobj.hide_render = True
    boo = surf.modifiers.new("Clip", "BOOLEAN")
    boo.operation, boo.solver, boo.object = "INTERSECT", "MANIFOLD", hexobj

    def mat(name, rgb=None, gradient=False, rough=ROUGH, coat=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        p = nt.nodes["Principled BSDF"]
        p.inputs["Roughness"].default_value = rough
        if not gradient and "Specular IOR Level" in p.inputs:
            p.inputs["Specular IOR Level"].default_value = 0.2  # less grey sheen in the grooves
        if "Coat Weight" in p.inputs:
            p.inputs["Coat Weight"].default_value = coat
        if gradient:
            tc = nt.nodes.new("ShaderNodeTexCoord")
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            mathn = nt.nodes.new("ShaderNodeMath")
            mathn.operation = "ADD"
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
            nt.links.new(sep.outputs["Y"], mathn.inputs[0])
            nt.links.new(sep.outputs["X"], mathn.inputs[1])
            mul = nt.nodes.new("ShaderNodeMapRange")
            mul.inputs["From Min"].default_value, mul.inputs["From Max"].default_value = 1.2, -1.2
            nt.links.new(mathn.outputs[0], mul.inputs["Value"])
            nt.links.new(mul.outputs["Result"], ramp.inputs["Fac"])
            ramp.color_ramp.elements[0].color = (*LIGHT, 1)
            ramp.color_ramp.elements[1].color = (*DARK, 1)
            nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
        else:
            p.inputs["Base Color"].default_value = (*rgb, 1)
        return m

    surf.data.materials.append(mat("Tile", gradient=True, coat=0.6))
    for i, rgb in enumerate(FLOORS):
        surf.data.materials.append(mat(f"Floor{i}", rgb, rough=0.35))
    return surf


def stage():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.view_settings.view_transform = "Standard"

    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.92, 1.0, 0.92, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22

    def area(name, loc, power, size, color=(1, 1, 1)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size, light.color = power, size, color
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(obj)

    area("Key", (-2.4, 2.2, 4.0), 170, 2.2, (1.0, 1.0, 0.92))   # top-left, like the original
    area("Fill", (2.6, -2.0, 3.0), 40, 3.0, (0.85, 1.0, 0.9))
    area("Rim", (2.8, 2.6, 1.2), 90, 1.5, (0.9, 1.0, 0.6))
    area("Top", (0, -0.8, 6.0), 18, 4.0)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 118
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0, -1.3, 7.6)
    cam.rotation_euler = (Vector((0, 0, -0.1)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam


bpy.ops.wm.read_factory_settings(use_empty=True)
build()
stage()
bpy.context.scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("WROTE", OUT)
