import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Drag-activation props to spread onto whatever element should act as the
 *  handle — only handed to renderItem when `inlineHandle` is set. */
export type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
  dragHandleClassName,
  inlineHandle,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, handle: DragHandleProps) => ReactNode;
  className?: string;
  dragHandleClassName?: string;
  /**
   * When true, no grip button is rendered beside the item — renderItem gets
   * drag-activation props (attributes/listeners) as its second argument to
   * attach to an element of its own choosing, so the handle can live inside
   * the item's own card instead of next to it.
   */
  inlineHandle?: boolean;
}) {
  const sensors = useSensors(
    // 4px activation distance prevents accidental drags when the user intends a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // Resolve indices by id rather than storing them in state so the lookup
    // always reflects the current items array even after partial reorders.
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <SortableRow
              key={item.id}
              id={item.id}
              handleClassName={dragHandleClassName}
              inlineHandle={inlineHandle}
            >
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
  handleClassName,
  inlineHandle,
}: {
  id: string;
  children: (handle: DragHandleProps) => ReactNode;
  handleClassName?: string;
  inlineHandle?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  if (inlineHandle) {
    return (
      <li ref={setNodeRef} style={style}>
        {children({ attributes, listeners })}
      </li>
    );
  }
  return (
    <li ref={setNodeRef} style={style} className="flex items-stretch">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          "flex items-center pl-5 pr-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none",
          handleClassName,
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">{children({ attributes, listeners })}</div>
    </li>
  );
}
