import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, } from '~/components/ui/select'

import React from 'react'

function page() {
  return (
    <div><Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="system">System</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select></div>
  )
}

export default page