import {DndContext,closestCenter,PointerSensor,KeyboardSensor,useSensor,useSensors,type DragEndEvent} from '@dnd-kit/core';
import {SortableContext,useSortable,verticalListSortingStrategy,sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {GripVertical} from 'lucide-react';
import type {ReactNode} from 'react';
import {tracks} from './model.mjs';
type Props={ids:string[];renderItem:(id:string)=>ReactNode;onMove:(from:string,to:string)=>void};
function SortableRow({id,children}:{id:string;children:ReactNode}){
 const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id});
 const title=tracks.find(t=>t.id===id)?.title??id;
 return <div ref={setNodeRef} data-sortable-id={id} className={'sortable-track'+(isDragging?' dragging':'')} style={{transform:CSS.Transform.toString(transform),transition}}>
 <button type="button" ref={setActivatorNodeRef} className="drag-handle" {...attributes} {...listeners} aria-label={'Переместить '+title} title="Удерживайте и перетащите"><GripVertical size={22}/></button>
 <div className="sortable-content">{children}</div></div>;
}
export function SortableTrackList({ids,renderItem,onMove}:Props){
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
 function end({active,over}:DragEndEvent){if(over&&active.id!==over.id)onMove(String(active.id),String(over.id));}
 return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end} accessibility={{screenReaderInstructions:{draggable:'Нажмите пробел, чтобы поднять песню, стрелки вверх и вниз для перемещения, пробел для сохранения или Escape для отмены.'}}}><SortableContext items={ids} strategy={verticalListSortingStrategy}><div className="sortable-list" aria-label="Изменение порядка песен">{ids.map(id=><SortableRow key={id} id={id}>{renderItem(id)}</SortableRow>)}</div></SortableContext></DndContext>
}
