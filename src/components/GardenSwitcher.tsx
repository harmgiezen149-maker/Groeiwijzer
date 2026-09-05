'use client';

import { useRef } from 'react';
import { switchGarden } from '@/app/actions';
import type { Garden } from '@/lib/types';

export function GardenSwitcher({
  gardens,
  activeId,
}: {
  gardens: Garden[];
  activeId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  if (gardens.length < 2) {
    return <span className="bw-chip">{gardens[0]?.name ?? 'Tuin'}</span>;
  }

  return (
    <form ref={formRef} action={switchGarden}>
      <label className="sr-only" htmlFor="gardenId">
        Actieve tuin
      </label>
      <select
        id="gardenId"
        name="gardenId"
        defaultValue={activeId}
        onChange={() => formRef.current?.requestSubmit()}
        className="bw-select max-w-[45vw] py-1 text-sm"
      >
        {gardens.map((garden) => (
          <option key={garden.id} value={garden.id}>
            {garden.name}
          </option>
        ))}
      </select>
    </form>
  );
}
