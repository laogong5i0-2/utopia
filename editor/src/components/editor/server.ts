import { UTOPIA_BACKEND } from '../../common/env-vars'
import { assetURL, HEADERS, MODE, projectURL, thumbnailURL } from '../../common/server'
import { imageFile, isImageFile } from '../../core/model/project-file-utils'
import { ImageFile } from '../../core/shared/project-file-types'
import Utils from '../../utils/utils'
import { PersistentModel } from './store/editor-state'
import { PRODUCTION_CONFIG } from '../../core/shared/detect-env'

export { fetchProjectList, fetchShowcaseProjects, getLoginState } from '../../common/server'

export const PROJECT_ID_ENDPOINT = UTOPIA_BACKEND(PRODUCTION_CONFIG) + 'projectid/'

interface CreateProjectResponse {
  id: string
}

interface SaveProjectResponse {
  id: string
  ownerId: string
}

interface ProjectLoaded {
  type: 'ProjectLoaded'
  id: string
  ownerId: string
  title: string
  createdAt: string
  modifiedAt: string
  content: PersistentModel
}

interface ProjectUnchanged {
  type: 'ProjectUnchanged'
  id: string
}

type LoadProjectResponse = ProjectLoaded | ProjectUnchanged

interface SaveAssetResponse {
  id: string
}

interface SaveProjectRequest {
  name: string | null
  content: PersistentModel | null
}

export async function createNewProjectID(): Promise<string> {
  // POSTs the persistent model as JSON body. receives a project ID
  const response = await fetch(PROJECT_ID_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: HEADERS,
    mode: MODE,
  })
  if (response.ok) {
    const result: CreateProjectResponse = await response.json()
    return result.id
  } else {
    // FIXME Client should show an error if server requests fail
    throw new Error(
      `Create new project request failed (${response.status}): ${response.statusText}`,
    )
  }
}

export async function updateSavedProject(
  projectId: string,
  persistentModel: PersistentModel | null,
  name: string,
): Promise<SaveProjectResponse> {
  // PUTs the persistent model as JSON body.
  const url = projectURL(PRODUCTION_CONFIG, projectId)
  const bodyValue: SaveProjectRequest = {
    name: name,
    content: persistentModel,
  }
  const postBody = JSON.stringify(bodyValue)
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    body: postBody,
    headers: HEADERS,
    mode: MODE,
  })
  if (response.ok) {
    return response.json()
  } else {
    // FIXME Client should show an error if server requests fail
    throw new Error(`Save project request failed (${response.status}): ${response.statusText}`)
  }
}

export async function loadProject(
  projectId: string,
  lastSavedTS: string | null = null,
): Promise<LoadProjectResponse> {
  // GETs the persistent model as a JSON body
  const baseUrl = projectURL(PRODUCTION_CONFIG, projectId)
  const url = lastSavedTS == null ? baseUrl : `${baseUrl}?last_saved=${lastSavedTS}`
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: HEADERS,
    mode: MODE,
  })
  if (response.ok) {
    return response.json()
  } else {
    // FIXME Client should show an error if server requests fail
    throw new Error(`server responded with ${response.status} ${response.statusText}`)
  }
}

export async function updateAssetFileName(
  productionConfig: boolean,
  projectId: string,
  oldFileName: string,
  newFileName: string,
): Promise<void> {
  const baseUrl = assetURL(productionConfig, projectId, newFileName)
  const url = `${baseUrl}?old_file_name=${oldFileName}`
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: HEADERS,
    mode: MODE,
  })
  if (response.ok) {
    return
  } else {
    throw new Error(
      `Update asset file name request failed (${response.status}): ${response.statusText}`,
    )
  }
}

export async function deleteAssetFile(
  productionConfig: boolean,
  projectId: string,
  fileName: string,
): Promise<void> {
  const url = assetURL(productionConfig, projectId, fileName)
  const response = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: HEADERS,
    mode: MODE,
  })
  if (response.ok) {
    return
  } else {
    throw new Error(`Delete asset request failed (${response.status}): ${response.statusText}`)
  }
}

async function saveAssetRequest(
  productionConfig: boolean,
  projectId: string,
  fileType: string,
  base64: string,
  fileName: string,
): Promise<void> {
  const asset = Buffer.from(base64, 'base64')
  const url = assetURL(productionConfig, projectId, fileName)
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': fileType,
    },
    body: asset,
  })
  if (response.ok) {
    return
  } else {
    throw new Error(`Save asset request failed (${response.status}): ${response.statusText}`)
  }
}

export async function saveAsset(
  productionConfig: boolean,
  projectId: string,
  fileType: string,
  base64: string,
  imageId: string,
): Promise<void> {
  try {
    return saveAssetRequest(productionConfig, projectId, fileType, base64, imageId)
  } catch (e) {
    // FIXME Client should show an error if server requests fail
    console.error(e)
    return
  }
}

export async function saveImagesFromProject(
  productionConfig: boolean,
  projectId: string,
  model: PersistentModel,
): Promise<PersistentModel> {
  let promises: Array<Promise<{ contentId: string; projectContent: ImageFile }>> = []

  Utils.fastForEach(Object.keys(model.projectContents), (contentId) => {
    const projectContent = model.projectContents[contentId]
    if (
      isImageFile(projectContent) &&
      projectContent.base64 != null &&
      projectContent.imageType != null
    ) {
      try {
        promises.push(
          saveAssetRequest(
            productionConfig,
            projectId,
            projectContent.imageType,
            projectContent.base64,
            contentId,
          ).then(() => {
            return { contentId: contentId, projectContent: projectContent }
          }),
        )
      } catch (e) {
        // FIXME Client should show an error if server requests fail
        console.error(e)
      }
    }
  })

  return Promise.all(promises).then((updatedFiles) => {
    const projectContents = { ...model.projectContents }
    Utils.fastForEach(updatedFiles, ({ contentId, projectContent }) => {
      // Scrub the image type and base64
      projectContents[contentId] = imageFile(
        undefined,
        undefined,
        projectContent.width,
        projectContent.height,
        projectContent.hash,
      )
    })

    return {
      ...model,
      projectContents: projectContents,
    }
  })
}

export async function saveThumbnail(
  productionConfig: boolean,
  thumbnail: Buffer,
  projectId: string,
): Promise<void> {
  const url = thumbnailURL(productionConfig, projectId)
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'image/png',
    },
    body: thumbnail,
  })
  if (response.ok) {
    return
  } else {
    // FIXME Client should show an error if server requests fail
    console.error(`Save thumbnail request failed (${response.status}): ${response.statusText}`)
    return
  }
}
