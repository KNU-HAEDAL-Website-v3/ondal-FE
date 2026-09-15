import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '@/api/tags'
import type { TagResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiErrorView, EmptyState } from '@/components/ApiErrorView'
import { LoadingScreen } from '@/components/LoadingScreen'

/**
 * 태그 관리 (관리자 전용) - /admin/tags.
 *
 * 만드는 권한을 관리자로 좁힌 이유: 운영진이 자유로 만들면 "DP / 다이나믹프로그래밍 / dp" 로 갈라져 분류가 쓸모없어진다.
 * 이름을 고치면 붙어 있던 문제의 표시도 함께 바뀐다(연결은 그대로) - 오타 정정이 곧 전체 반영.
 */
export default function AdminTagsPage() {
  const tagsQuery = useTags()
  const createMutation = useCreateTag()
  const updateMutation = useUpdateTag()
  const deleteMutation = useDeleteTag()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (createMutation.isPending || newName.trim() === '') return
    createMutation.mutate({ name: newName.trim() }, { onSuccess: () => setNewName('') })
  }

  const handleRename = (e: FormEvent) => {
    e.preventDefault()
    if (editingId === null || updateMutation.isPending || editingName.trim() === '') return
    updateMutation.mutate(
      { tagId: editingId, payload: { name: editingName.trim() } },
      { onSuccess: () => setEditingId(null) },
    )
  }

  const handleDelete = (tag: TagResponse) => {
    if (!window.confirm(`태그 "${tag.name}" 을(를) 삭제할까요?\n이 태그를 쓰는 문제가 있으면 삭제되지 않아요.`)) return
    deleteMutation.mutate(tag.id)
  }

  const error = createMutation.error ?? updateMutation.error ?? deleteMutation.error

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/problems">
          <ArrowLeft data-icon="inline-start" />
          HOJ 목록으로
        </Link>
      </Button>

      <header className="border-b pb-2.5">
        <h1 className="text-2xl font-bold tracking-tight">태그 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          문제를 알고리즘·자료구조로 묶는 이름표예요. 표기가 갈라지지 않도록 관리자만 만들고 고칠 수 있어요.
        </p>
      </header>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="new-tag">새 태그 이름</Label>
          <Input
            id="new-tag"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={40}
            placeholder="예: 다이나믹 프로그래밍"
          />
        </div>
        <Button type="submit" className="rounded-[2px]" disabled={createMutation.isPending || newName.trim() === ''}>
          <Plus data-icon="inline-start" />
          {createMutation.isPending ? '추가 중...' : '태그 추가'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {tagsQuery.isPending ? (
        <LoadingScreen label="태그 불러오는 중..." />
      ) : tagsQuery.error ? (
        <ApiErrorView error={tagsQuery.error} onRetry={() => void tagsQuery.refetch()} />
      ) : tagsQuery.data.length === 0 ? (
        <EmptyState icon={<Tags className="size-8" />} title="아직 태그가 없어요" description="위에서 첫 태그를 만들어 보세요." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {tagsQuery.data.map((tag) => (
            <li key={tag.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              {editingId === tag.id ? (
                <form onSubmit={handleRename} className="flex flex-1 flex-wrap items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    maxLength={40}
                    aria-label={`${tag.name} 이름 수정`}
                    className="max-w-64"
                  />
                  <Button type="submit" size="sm" className="rounded-[2px]" disabled={updateMutation.isPending}>
                    저장
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)} aria-label="취소">
                    <X className="size-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium">{tag.name}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="rounded-[2px]"
                    onClick={() => {
                      setEditingId(tag.id)
                      setEditingName(tag.name)
                    }}
                  >
                    <Pencil data-icon="inline-start" />
                    이름 수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="rounded-[2px] text-destructive"
                    onClick={() => handleDelete(tag)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 data-icon="inline-start" />
                    삭제
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
