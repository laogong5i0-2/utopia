import { LiveObject, type CommentData, type ThreadData, type User } from '@liveblocks/client'
import {
  useMutation,
  type Presence,
  type ThreadMetadata,
  type UserMeta,
  useStorage,
} from '../../../liveblocks.config'
import { possiblyUniqueInArray, safeIndex, stripNulls, uniqBy } from './array-utils'
import { colorTheme } from '../../uuiui'
import type { ElementPath } from './project-file-types'
import {
  setHighlightedView,
  switchEditorMode,
} from '../../components/editor/actions/action-creators'
import { EditorModes, existingComment } from '../../components/editor/editor-modes'
import { useMyUserId } from './multiplayer-hooks'

export type MultiplayerColor = {
  background: string
  foreground: string
}

export const multiplayerColors = [
  { background: '#10C458', foreground: colorTheme.bg0.value },
  { background: '#25B5B5', foreground: colorTheme.bg0.value },
  { background: '#6688E0', foreground: colorTheme.bg0.value },
  { background: '#7382A7', foreground: colorTheme.bg0.value },
  { background: '#96AB14', foreground: colorTheme.bg0.value },
  { background: '#A05FD3', foreground: colorTheme.bg0.value },
  { background: '#B99829', foreground: colorTheme.bg0.value },
  { background: '#CE72BA', foreground: colorTheme.bg0.value },
  { background: '#E55A6A', foreground: colorTheme.bg0.value },
  { background: '#EB6837', foreground: colorTheme.bg0.value },
]

function randomMultiplayerColor(): number {
  return Math.floor(Math.random() * multiplayerColors.length)
}

export function possiblyUniqueColor(existing: (number | null)[]): number {
  return possiblyUniqueInArray(
    multiplayerColors.map((_, index) => index),
    existing,
    randomMultiplayerColor(),
  )
}

export function multiplayerColorFromIndex(colorIndex: number | null): MultiplayerColor {
  const fallbackColor = {
    background: '#000',
    foreground: '#fff',
  }
  if (colorIndex == null) {
    return fallbackColor
  }

  const colors = multiplayerColors
  return safeIndex(colors, colorIndex) ?? fallbackColor
}

/**
 * Returns the initials from the given name, to be displayed on e.g. avatars or comments.
 * If the name is made of multiple words, the first letter of the first two words will be returned ('John Doe' -> 'JD').
 * If the name is made of a single word, the first two letters of the word will be returned ('John' -> 'JO').
 * If the name is shorter than two letters, the result will be padded with 'X' characters ('F' -> 'FX').
 */
export function multiplayerInitialsFromName(name: string): string {
  const baseName = name.trim().toUpperCase()

  const words = baseName.split(/\s+/)
  if (words.length >= 2) {
    return words[0].charAt(0) + words[1].charAt(0)
  } else if (baseName.length > 1) {
    return baseName.charAt(0) + baseName.charAt(1)
  } else {
    return baseName.padEnd(2, 'X')
  }
}

export function normalizeMultiplayerName(name: string | null): string {
  if (name == null) {
    return 'Unknown'
  }
  return name.trim().replace(/@.+$/, '')
}

export function normalizeOthersList(
  selfId: string,
  others: readonly User<Presence, UserMeta>[],
): User<Presence, UserMeta>[] {
  return uniqBy(
    others.filter((other) => other.id !== selfId),
    (a, b) => a.id === b.id,
  )
}

const reAuth0DefaultAvatarURLEncoded = /https%3A%2F%2Fcdn\.auth0\.com%2Favatars%2F.{2}\.png$/
const reAuth0DefaultAvatar = /https:\/\/cdn\.auth0\.com\/avatars\/.{2}\.png$/

export function isDefaultAuth0AvatarURL(s: string | null): boolean {
  return (
    s != null &&
    (s.match(reAuth0DefaultAvatarURLEncoded) != null || s.match(reAuth0DefaultAvatar) != null)
  )
}

export function canFollowTarget(
  selfId: string,
  targetId: string | null,
  others: { id: string; following: string | null }[],
): boolean {
  let followChain: Set<string> = new Set()

  let id = targetId
  while (id != null) {
    if (followChain.has(id)) {
      return false
    }
    followChain.add(id)

    const target = others.find((o) => o.id === id)
    id = target?.following ?? null
  }

  return !followChain.has(selfId)
}

const roomIdPrefix = `project-room-`

export function projectIdToRoomId(projectId: string): string {
  return `${roomIdPrefix}${projectId}`
}

export function isRoomId(s: string): boolean {
  return s.startsWith(roomIdPrefix)
}

export type RemixPresence = {
  scene: string
  locationRoute: string | null
}

export function isPlayerOnAnotherRemixRoute(
  a: RemixPresence | null,
  b: RemixPresence | null,
): boolean {
  return a != null && b != null && (a.scene !== b.scene || a.locationRoute !== b.locationRoute)
}

export function remixPresence(scene: string, locationRoute: string | null): RemixPresence {
  return {
    scene: scene,
    locationRoute: locationRoute,
  }
}

export function maybeRemixPresence(
  scene: string | null,
  locationRoute: string | null,
): RemixPresence | null {
  return scene != null ? remixPresence(scene, locationRoute) : null
}

export function openCommentThreadActions(threadId: string, scene: ElementPath | null) {
  return stripNulls([
    switchEditorMode(EditorModes.commentMode(existingComment(threadId), 'not-dragging')),
    scene != null ? setHighlightedView(scene) : null,
  ])
}

export function getFirstComment(thread: ThreadData<ThreadMetadata>): CommentData | null {
  return thread.comments.filter((c) => c.deletedAt == null)[0] ?? null
}

export function sortThreadsByDescendingUpdateTimeInPlace(
  threads: Array<ThreadData<ThreadMetadata>>,
) {
  function lastModificationDate(t: ThreadData<ThreadMetadata>) {
    return t.updatedAt ?? t.createdAt
  }

  threads.sort((t1, t2) => lastModificationDate(t2).getTime() - lastModificationDate(t1).getTime())
}

export function useUpdateRemixSceneRouteInLiveblocks() {
  return useMutation(({ storage, self }, params: { sceneDataLabel: string; location: string }) => {
    const sceneRoutes = storage.get('remixSceneRoutes')
    const mySceneRoutes = sceneRoutes.get(self.id)
    if (mySceneRoutes == null) {
      const myNewSceneRoutes = new LiveObject({ [params.sceneDataLabel]: params.location })
      sceneRoutes.set(self.id, myNewSceneRoutes)
    } else {
      mySceneRoutes.set(params.sceneDataLabel, params.location)
    }
  }, [])
}

export function useIsOnSameRemixRoute() {
  const id = useMyUserId()
  const remixSceneRoutes = useStorage((store) => store.remixSceneRoutes)
  if (id == null) {
    return () => true
  }

  return (params: { otherUserId: string; remixSceneDataLabel: string }): boolean => {
    const remixScenePathForMe: string | null =
      remixSceneRoutes[id]?.[params.remixSceneDataLabel] ?? null
    const remixScenePathForOther: string | null =
      remixSceneRoutes[params.otherUserId]?.[params.remixSceneDataLabel] ?? null

    if (remixScenePathForMe == null || remixScenePathForOther == null) {
      return true
    }

    return remixScenePathForMe === remixScenePathForOther
  }
}
