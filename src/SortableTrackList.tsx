import {DndContext,closestCenter,PointerSensor,useSensor,useSensors,type DragEndEvent} from '@dnd-kit/core';
import {SortableContext,useSortable,verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {GripVertical} from 'lucide-react';
import type {ReactNode} from 'react';
type Props={ids:string[];renderItem:(id:string)=>ReactNode;onMove:(from:string,to:string)=>void;itemLabel?:(id:string)=>string;label?:string};
function SortableRow({id,children,onArrow,itemLabel}:{id:string;children:ReactNode;onArrow:(direction:number)=>void;itemLabel?:(id:string)=>string}){
 const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id});
 const title=itemLabel?.(id)??id;
 return <div ref={setNodeRef} data-sortable-id={id} className={'sortable-track'+(isDragging?' dragging':'')} style={{transform:CSS.Transform.toString(transform),transition}}>
 <button type="button" ref={setActivatorNodeRef} className="drag-handle" {...attributes} {...listeners} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();onArrow(e.key==='ArrowUp'?-1:1)}}} aria-label={'Переместить '+title} title="Перетащите или используйте стрелки вверх и вниз"><GripVertical size={22}/></button>
 <div className="sortable-content">{children}</div></div>;
}
export function SortableTrackList({ids,renderItem,onMove,itemLabel,label='Изменение порядка песен'}:Props){
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}));
 function end({active,over}:DragEndEvent){if(over&&active.id!==over.id)onMove(String(active.id),String(over.id));}
 return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end} accessibility={{screenReaderInstructions:{draggable:'Используйте стрелки вверх и вниз на ручке для изменения порядка.'}}}><SortableContext items={ids} strategy={verticalListSortingStrategy}><div className="sortable-list" aria-label={label}>{ids.map((id,i)=><SortableRow key={id} id={id} itemLabel={itemLabel} onArrow={direction=>{const target=ids[i+direction];if(target)onMove(id,target)}}>{renderItem(id)}</SortableRow>)}</div></SortableContext></DndContext>
}
