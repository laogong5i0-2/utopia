import { LoaderFunctionArgs, json } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import moment from 'moment'
import { UserDetails } from 'prisma-client'
import React, { useEffect, useState } from 'react'
import { listDeletedProjects, listProjects } from '../models/project.server'
import { newProjectButton } from '../styles/newProjectButton.css'
import { projectCategoryButton, userName } from '../styles/sidebarComponents.css'
import { sprinkles } from '../styles/sprinkles.css'
import { requireUser } from '../util/api.server'
import { ProjectWithoutContent } from '../types'
import { assertNever } from '../util/assertNever'
import { button } from '../styles/button.css'

export async function loader(args: LoaderFunctionArgs) {
  const user = await requireUser(args.request)

  const projects = await listProjects({
    ownerId: user.user_id,
  })

  const deletedProjects = await listDeletedProjects({
    ownerId: user.user_id,
  })

  return json({ projects, deletedProjects, user })
}

type ProjectsPageState = {
  selectedProjectId: string | null
}

const Categories = ['allProjects', 'trash'] as const

export type Category = (typeof Categories)[number]

const categories: { [key in Category]: { name: string } } = {
  allProjects: { name: 'All My Projects' },
  trash: { name: 'Trash' },
}
const ProjectsPage = React.memo(() => {
  const marginSize = 30
  const rowHeight = 30

  const [selectedProject, setSelectedProject] = useState<ProjectsPageState>({
    selectedProjectId: null,
  })

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject({ selectedProjectId: projectId })
  }
  const clearSelectedProject = () => setSelectedProject({ selectedProjectId: null })

  const [selectedCategory, setSelectedCategory] = useState<Category>('allProjects')

  const handleCategoryClick = (category: React.SetStateAction<string>) => {
    setSelectedCategory(category as Category)
  }

  const data = useLoaderData() as unknown as {
    projects: ProjectWithoutContent[]
    user: UserDetails
    deletedProjects: ProjectWithoutContent[]
  }

  const [projects, setProjects] = React.useState<ProjectWithoutContent[]>([])

  const [searchValue, setSearchValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithoutContent[]>([])

  const updateProjects = React.useCallback(() => {
    switch (selectedCategory) {
      case 'allProjects':
        setProjects(data.projects)
        break
      case 'trash':
        setProjects(data.deletedProjects)
        break
      default:
        assertNever(selectedCategory)
    }
  }, [selectedCategory, data.projects, data.deletedProjects])

  React.useEffect(() => {
    updateProjects()
  }, [updateProjects])

  const filterProjects = React.useCallback(() => {
    if (searchValue === '') {
      setFilteredProjects(projects)
      setSearchQuery('')
    } else {
      const filteredProjects = projects.filter((project) =>
        project.title.toLowerCase().includes(searchValue.toLowerCase()),
      )
      setFilteredProjects(filteredProjects)
      setSearchQuery(searchValue)
    }
  }, [projects])

  React.useEffect(() => {
    filterProjects()
  }, [searchValue, projects])

  const createNewProject = () => {
    window.open(`${window.ENV.EDITOR_URL}/project/`, '_blank')
  }

  const newProjectButtons = [
    {
      id: 'createProject',
      title: '+ Blank Project',
      onClick: createNewProject,
      color: 'orange',
    },
    // {
    //   title: '+ Project On GitHub',
    //   onClick: createNewProject,
    //   color: 'pink',
    // },
    // {
    //   title: '+ Import From GitHub',
    //   onClick: createNewProject,
    //   color: 'purple',
    // },
    // {
    //   title: '+ Remix Project',
    //   onClick: createNewProject,
    //   color: 'blue',
    // },
    // {
    //   title: '+ Shopify Store',
    //   onClick: createNewProject,
    //   color: 'green',
    // },
  ] as const

  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const handleColorSchemeChange = (event: {
      matches: boolean | ((prevState: boolean) => boolean)
    }) => {
      setIsDarkMode(event.matches)
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDarkMode(mediaQuery.matches)
    mediaQuery.addListener(handleColorSchemeChange)

    return () => {
      mediaQuery.removeListener(handleColorSchemeChange)
    }
  }, [])

  const logoPic = isDarkMode ? 'url(assets/pyramid_dark.png)' : 'url(assets/pyramid_light.png)'

  return (
    <div
      style={{
        margin: marginSize,
        height: `calc(100vh - ${marginSize * 2}px)`,
        width: `calc(100vw - ${marginSize * 2}px)`,
        gap: marginSize,
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        userSelect: 'none',
      }}
    >
      <div
        onMouseDown={clearSelectedProject}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 230,
          flexShrink: 0,
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <img
              className={sprinkles({ borderRadius: 'medium' })}
              style={{ width: 40 }}
              src={data.user.picture ?? undefined}
              referrerPolicy='no-referrer'
            />
            <div className={userName({})}>{data.user.name}</div>
          </div>

          <input
            id='search-input'
            autoFocus={true}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                filterProjects()
              }
            }}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'grey',
              height: rowHeight,
              borderBottom: '1px solid gray',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0 14px',
            }}
            placeholder='Search...'
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {Object.entries(categories).map(([category, data]) => {
              return (
                <button
                  key={`category-${category}`}
                  className={projectCategoryButton({
                    color: category === selectedCategory ? 'selected' : 'neutral',
                  })}
                  onClick={() => handleCategoryClick(category)}
                >
                  <span>{data.name}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            fontFamily: 'Reckless',
            fontSize: 34,
          }}
        >
          <div
            style={{
              height: 60,
              width: 45,
              backgroundSize: '45px',
              backgroundRepeat: 'no-repeat',
              backgroundImage: logoPic,
            }}
          />
          Utopia
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexGrow: 1,
          flexDirection: 'column',
          gap: marginSize,
        }}
      >
        <div
          onMouseDown={clearSelectedProject}
          style={{
            height: 60,
            flex: 0,
            display: 'flex',
            flexDirection: 'row',
            gap: 15,
          }}
        >
          {newProjectButtons.map((p) => (
            <button key={p.id} className={newProjectButton({ color: p.color })} onClick={p.onClick}>
              <span>{p.title}</span>
            </button>
          ))}
        </div>
        <div
          onMouseDown={clearSelectedProject}
          style={{ fontSize: 16, fontWeight: 600, padding: '5px 10px' }}
        >
          {searchQuery !== '' ? (
            <span>
              <span style={{ color: 'gray', paddingRight: 3 }}>
                <span
                  onClick={() => {
                    setSearchValue('')
                    setFilteredProjects(projects)
                    setSearchQuery('')
                    const inputElement = document.getElementById('search-input') as HTMLInputElement
                    if (inputElement) {
                      inputElement.value = ''
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  ←{' '}
                </span>{' '}
                Search results for
              </span>
              <span> "{searchQuery}"</span>
            </span>
          ) : (
            categories[selectedCategory].name
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: marginSize,
            flexGrow: 1,
            flexDirection: 'row',
            overflowY: 'scroll',
            scrollbarColor: 'lightgrey transparent',
          }}
        >
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.proj_id}
              project={project}
              selected={project.proj_id === selectedProject.selectedProjectId}
              onSelect={() => handleProjectSelect(project.proj_id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
})
ProjectsPage.displayName = 'ProjectsPage'

export default ProjectsPage

type ProjectCardProps = {
  project: ProjectWithoutContent
  selected: boolean
  onSelect: () => void
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, selected, onSelect }) => {
  const openProject = React.useCallback(() => {
    window.open(`${window.ENV.EDITOR_URL}/p/${project.proj_id}`, '_blank')
  }, [project.proj_id])

  return (
    <div
      style={{
        height: 200,
        width: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      <div
        style={{
          border: selected ? '2px solid #0075F9' : '2px solid transparent',
          borderRadius: 10,
          overflow: 'hidden',
          height: 180,
          width: '100%',
          background: 'linear-gradient(rgba(77, 255, 223, 0.4), rgba(255,250,220,.8))',
          backgroundAttachment: 'local',
          backgroundRepeat: 'no-repeat',
        }}
        onMouseDown={onSelect}
        onDoubleClick={openProject}
      />
      <ProjectActions project={project} />
    </div>
  )
}

const ProjectActions = React.memo(({ project }: { project: ProjectWithoutContent }) => {
  const fetcher = useFetcher()

  const deleteProject = React.useCallback(() => {
    if (project.deleted === true) {
      const ok = window.confirm('Are you sure? The project contents will be deleted permanently.')
      if (ok) {
        fetcher.submit(
          {},
          { method: 'POST', action: `/internal/projects/${project.proj_id}/destroy` },
        )
      }
    } else {
      fetcher.submit({}, { method: 'POST', action: `/internal/projects/${project.proj_id}/delete` })
    }
  }, [fetcher])

  const restoreProject = React.useCallback(() => {
    fetcher.submit({}, { method: 'POST', action: `/internal/projects/${project.proj_id}/restore` })
  }, [fetcher])

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: 10, gap: 5, flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{project.title}</div>
        <div>{moment(project.modified_at).fromNow()}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {project.deleted === true ? (
          <button className={button({ size: 'small' })} onClick={restoreProject}>
            Restore
          </button>
        ) : null}
        <button className={button({ color: 'danger', size: 'small' })} onClick={deleteProject}>
          Delete
        </button>
        <fetcher.Form />
      </div>
    </div>
  )
})
ProjectActions.displayName = 'ProjectActions'
