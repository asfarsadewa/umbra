"""
Prepare AI-generated (gpt-image-2.5-sunburst -> fal Hunyuan 3D 3.1 Pro) meshes
for UMBRA.

- bakes transforms, orients the model so its front faces +X
- centres and grounds it, scales to a target height
- decimates to a game triangle budget, downscales textures
- (optionally) builds an armature, computes skin weights and authors
  idle/walk clips, then exports a self-contained GLB

Run headless (this is the same Blender the MCP drives):

  blender --background --factory-startup --python tools/blender/prepare_ai_models.py -- \
      --kind shade --input output/3d/shade-<stamp>/model.glb --out public/models/shade.glb \
      --height 0.62 --tris 12000 --yaw 90 --rig

  blender --background --factory-startup --python tools/blender/prepare_ai_models.py -- \
      --kind pillar --input output/3d/pillar-<stamp>/model.glb --out public/models/pillar.glb \
      --height 1.75 --tris 6000 --yaw 90
"""

import argparse
import math
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--height", type=float, default=1.0)
    parser.add_argument("--width", type=float, default=0.0)
    parser.add_argument("--fit", choices=["height", "width"], default="height")
    parser.add_argument("--flatten", type=float, default=1.0)
    parser.add_argument("--tris", type=int, default=12000)
    parser.add_argument("--yaw", type=float, default=0.0)
    parser.add_argument("--max-texture", type=int, default=1024)
    parser.add_argument("--rig", action="store_true")
    return parser.parse_args(argv)


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bake_transforms():
    for obj in mesh_objects():
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        obj.parent = None


def bounds(objects):
    low = Vector((1e9, 1e9, 1e9))
    high = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for vertex in obj.data.vertices:
            co = vertex.co
            low.x, low.y, low.z = min(low.x, co.x), min(low.y, co.y), min(low.z, co.z)
            high.x, high.y, high.z = (
                max(high.x, co.x),
                max(high.y, co.y),
                max(high.z, co.z),
            )
    return low, high


def apply_mesh_transform(objects, matrix):
    for obj in objects:
        obj.data.transform(matrix)
        obj.data.update()


def decimate(obj, target_tris):
    obj.data.calc_loop_triangles()
    current = len(obj.data.loop_triangles)
    if current <= target_tris:
        return current
    activate(obj)
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = max(0.001, target_tris / current)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def downscale_textures(max_size=1024):
    for image in bpy.data.images:
        if image.size[0] > max_size or image.size[1] > max_size:
            scale = max_size / max(image.size[0], image.size[1])
            image.scale(
                max(1, int(image.size[0] * scale)),
                max(1, int(image.size[1] * scale)),
            )


# --------------------------------------------------------------------------
# rig
# --------------------------------------------------------------------------


def build_armature(name, height, width, depth):
    arm_data = bpy.data.armatures.new(f"{name}Rig")
    armature = bpy.data.objects.new(f"{name}Rig", arm_data)
    bpy.context.collection.objects.link(armature)
    activate(armature)
    bpy.ops.object.mode_set(mode="EDIT")

    H = height
    hip_y = 0.055 * H
    knee_y = 0.065 * H
    ankle_y = 0.065 * H
    shoulder_y = 0.105 * H
    elbow_y = 0.155 * H
    hand_y = 0.185 * H

    specs = {
        "Root": (((0, 0, 0), (0, 0, 0.08 * H)), None),
        "Hips": (((0, 0, 0.50 * H), (0, 0, 0.72 * H)), "Root"),
        "Spine": (((0, 0, 0.72 * H), (0, 0, 0.83 * H)), "Hips"),
        "Head": (((0, 0, 0.83 * H), (0, 0, 0.99 * H)), "Spine"),
        "ThighL": (((0, hip_y, 0.50 * H), (0, knee_y, 0.27 * H)), "Hips"),
        "ShinL": (((0, knee_y, 0.27 * H), (0, ankle_y, 0.06 * H)), "ThighL"),
        "FootL": (((0, ankle_y, 0.06 * H), (0.09 * H, ankle_y, 0.02 * H)), "ShinL"),
        "ThighR": (((0, -hip_y, 0.50 * H), (0, -knee_y, 0.27 * H)), "Hips"),
        "ShinR": (((0, -knee_y, 0.27 * H), (0, -ankle_y, 0.06 * H)), "ThighR"),
        "FootR": (((0, -ankle_y, 0.06 * H), (0.09 * H, -ankle_y, 0.02 * H)), "ShinR"),
        "UpperArmL": (((0, shoulder_y, 0.78 * H), (0, elbow_y, 0.60 * H)), "Spine"),
        "ForearmL": (((0, elbow_y, 0.60 * H), (0, hand_y, 0.45 * H)), "UpperArmL"),
        "UpperArmR": (((0, -shoulder_y, 0.78 * H), (0, -elbow_y, 0.60 * H)), "Spine"),
        "ForearmR": (((0, -elbow_y, 0.60 * H), (0, -hand_y, 0.45 * H)), "UpperArmR"),
    }

    created = {}
    for bone_name, ((head, tail), parent) in specs.items():
        bone = arm_data.edit_bones.new(bone_name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        bone.roll = 0.0
        if parent:
            bone.parent = created[parent]
            bone.use_connect = False
        created[bone_name] = bone

    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def dist_point_segment(point, a, b):
    ab = b - a
    length_sq = ab.length_squared
    if length_sq < 1e-12:
        return (point - a).length
    t = max(0.0, min(1.0, (point - a).dot(ab) / length_sq))
    return (point - (a + ab * t)).length


def assign_weights(mesh_obj, armature):
    weight_bones = [b for b in armature.data.bones if b.name != "Root"]
    segments = [
        (
            bone.name,
            armature.matrix_world @ bone.head_local,
            armature.matrix_world @ bone.tail_local,
        )
        for bone in weight_bones
    ]
    groups = {name: mesh_obj.vertex_groups.new(name=name) for name, _, _ in segments}

    world = mesh_obj.matrix_world
    for vertex in mesh_obj.data.vertices:
        point = world @ vertex.co
        scored = sorted(
            (dist_point_segment(point, head, tail), name)
            for name, head, tail in segments
        )
        d0, n0 = scored[0]
        d1, n1 = scored[1]
        w0 = 1.0
        if d1 > 1e-5:
            a = 1.0 / (d0 + 1e-4)
            b = 1.0 / (d1 + 1e-4)
            w0 = a / (a + b)
        groups[n0].add([vertex.index], w0, "REPLACE")
        groups[n1].add([vertex.index], 1.0 - w0, "REPLACE")

    mesh_obj.parent = armature
    mesh_obj.matrix_parent_inverse = armature.matrix_world.inverted()
    modifier = mesh_obj.modifiers.new("Armature", "ARMATURE")
    modifier.object = armature

    smooth_weights(mesh_obj, iterations=2, factor=0.5)


def smooth_weights(mesh_obj, iterations=2, factor=0.5):
    mesh = mesh_obj.data
    count = len(mesh.vertices)
    adjacency = [[] for _ in range(count)]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)

    weights = [
        {group.group: group.weight for group in vertex.groups}
        for vertex in mesh.vertices
    ]

    for _ in range(iterations):
        updated = []
        for index in range(count):
            accumulated = {k: v * (1.0 - factor) for k, v in weights[index].items()}
            neighbours = adjacency[index]
            if neighbours:
                share = factor / len(neighbours)
                for neighbour in neighbours:
                    for key, value in weights[neighbour].items():
                        accumulated[key] = accumulated.get(key, 0.0) + value * share
            updated.append(accumulated)
        weights = updated

    groups = {group.index: group for group in mesh_obj.vertex_groups}
    all_indices = [vertex.index for vertex in mesh.vertices]
    for group in mesh_obj.vertex_groups:
        group.remove(all_indices)
    for index, entries in enumerate(weights):
        total = sum(entries.values()) or 1.0
        for group_index, value in entries.items():
            normalized = value / total
            if normalized > 1e-4 and group_index in groups:
                groups[group_index].add([index], normalized, "REPLACE")


def _local_axis(bone, world_axis):
    return (bone.matrix_local.to_3x3().inverted() @ Vector(world_axis)).normalized()


def _set_rotation(pose_bone, rotations):
    quat = Quaternion((1, 0, 0, 0))
    for world_axis, angle in rotations:
        quat = quat @ Quaternion(_local_axis(pose_bone.bone, world_axis), angle)
    pose_bone.rotation_mode = "QUATERNION"
    pose_bone.rotation_quaternion = quat
    return quat


def _ensure_action(armature, name):
    if armature.animation_data is None:
        armature.animation_data_create()
    action = bpy.data.actions.new(name)
    armature.animation_data.action = action
    try:
        slot = action.slots.new(id_type="OBJECT", name=armature.name)
        armature.animation_data.action_slot = slot
    except Exception:
        pass
    return action


def _pose(armature, rotations, root_loc=(0.0, 0.0, 0.0)):
    frame = bpy.context.scene.frame_current
    for bone_name, bone_rotations in rotations.items():
        pose_bone = armature.pose.bones[bone_name]
        _set_rotation(pose_bone, bone_rotations)
        pose_bone.keyframe_insert("rotation_quaternion", frame=frame)
    root = armature.pose.bones["Root"]
    root.location = root_loc
    root.keyframe_insert("location", frame=frame)


Y = (0, 1, 0)  # swing forward/back (character faces +X)
X = (1, 0, 0)  # roll side to side
Z = (0, 0, 1)  # twist

D = math.radians


def author_idle(armature, H):
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 90
    _ensure_action(armature, "idle")

    def pose(sway, nod, breathe, bob):
        _pose(
            armature,
            {
                "Spine": [(Y, D(1.0) * breathe), (X, D(0.7) * sway)],
                "Head": [(Y, D(1.4) * nod), (Z, D(1.2) * sway)],
                "UpperArmL": [(Y, D(1.4) * breathe)],
                "UpperArmR": [(Y, D(1.4) * breathe)],
                "ForearmL": [(Y, D(1.0) * sway)],
                "ForearmR": [(Y, D(1.0) * sway)],
                "ThighL": [(Y, D(0.3) * sway)],
                "ThighR": [(Y, D(0.3) * sway)],
            },
            (0.0, 0.0, bob * H),
        )

    for frame, (sway, nod, breathe, bob) in {
        1: (0.0, 0.0, 0.0, 0.0),
        45: (1.0, 1.0, 1.0, -0.005),
        90: (0.0, 0.0, 0.0, 0.0),
    }.items():
        scene.frame_set(frame)
        pose(sway, nod, breathe, bob)


def author_walk(armature, H, glide=False):
    """The Shade glides; walkers swing their legs."""
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 25
    _ensure_action(armature, "walk")

    thigh = 6.0 if glide else 20.0
    shin = 4.0 if glide else 14.0
    arm = 5.0 if glide else 16.0
    forearm = 4.0 if glide else 10.0
    twist = 1.6 if glide else 2.5
    bob_amp = 0.006 if glide else 0.012

    def pose(swing, bob):
        _pose(
            armature,
            {
                "Spine": [(Y, D(3.0 if glide else 4.0)), (Z, D(twist) * swing)],
                "Head": [(Y, D(-1.5)), (Z, D(-twist * 0.6) * swing)],
                "ThighL": [(Y, D(thigh) * swing)],
                "ShinL": [(Y, D(-shin) * max(0.0, -swing))],
                "ThighR": [(Y, D(-thigh) * swing)],
                "ShinR": [(Y, D(-shin) * max(0.0, swing))],
                "UpperArmL": [(Y, D(-arm) * swing)],
                "UpperArmR": [(Y, D(arm) * swing)],
                "ForearmL": [(Y, D(forearm) * swing)],
                "ForearmR": [(Y, D(forearm) * swing)],
            },
            (0.0, 0.0, bob * H),
        )

    keys = {
        1: (1.0, 0.0),
        7: (0.0, bob_amp),
        13: (-1.0, 0.0),
        19: (0.0, bob_amp),
        25: (1.0, 0.0),
    }
    for frame, (swing, bob) in keys.items():
        scene.frame_set(frame)
        pose(swing, bob)


def push_actions_to_nla(armature, names):
    for name in names:
        action = bpy.data.actions[name]
        track = armature.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, action)
        track.mute = True
    armature.animation_data.action = None


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30

    if not args.input.lower().endswith(".glb"):
        raise ValueError("input must be a self-contained GLB")

    bpy.ops.import_scene.gltf(filepath=args.input)
    objects = mesh_objects()
    if not objects:
        raise ValueError("no meshes imported")
    bake_transforms()

    low, high = bounds(objects)
    apply_mesh_transform(
        objects,
        Matrix.Translation((-((low.x + high.x) / 2), -((low.y + high.y) / 2), 0)),
    )

    low, high = bounds(objects)
    if args.fit == "width" or args.width > 0:
        target = args.width if args.width > 0 else args.height
        scale = target / max(1e-6, max(high.x - low.x, high.y - low.y))
    else:
        scale = args.height / max(1e-6, high.z - low.z)
    apply_mesh_transform(objects, Matrix.Scale(scale, 4))

    if abs(args.yaw) > 1e-6:
        apply_mesh_transform(objects, Matrix.Rotation(math.radians(args.yaw), 4, "Z"))

    if abs(args.flatten - 1.0) > 1e-6:
        apply_mesh_transform(
            objects, Matrix.Diagonal(Vector((1.0, 1.0, args.flatten, 1.0)))
        )

    low, high = bounds(objects)
    apply_mesh_transform(
        objects,
        Matrix.Translation((-((low.x + high.x) / 2), -((low.y + high.y) / 2), -low.z)),
    )

    for obj in objects:
        activate(obj)
        bpy.ops.object.shade_smooth()

    total = 0
    for obj in objects:
        total += decimate(obj, args.tris)
    low, high = bounds(objects)
    print(
        f"decimated triangles: {total}  dims="
        f"{high.x - low.x:.3f} x {high.y - low.y:.3f} x {high.z - low.z:.3f}"
    )

    downscale_textures(args.max_texture)

    if args.rig:
        armature = build_armature(
            args.kind, args.height, high.y - low.y, high.x - low.x
        )
        for obj in objects:
            assign_weights(obj, armature)
        author_idle(armature, args.height)
        author_walk(armature, args.height, glide=args.kind == "shade")
        push_actions_to_nla(armature, ["idle", "walk"])
        selection = objects + [armature]
    else:
        selection = objects

    bpy.ops.object.select_all(action="DESELECT")
    for obj in selection:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = selection[0]

    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_animations=args.rig,
        export_animation_mode="ACTIONS",
        export_nla_strips=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_skins=args.rig,
    )
    print("WROTE", args.out)


if __name__ == "__main__":
    main()
