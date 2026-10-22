import {test,expect} from '@playwright/test';
test('schedule, track, persist and finish a workout',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Schedule a workout'}).click();
 await page.getByLabel('Session name').fill('Lower body');await page.getByRole('button',{name:'Add exercise'}).click();await page.getByLabel('Exercise',{exact:true}).fill('Back squat');await page.getByLabel('Sets',{exact:true}).fill('2');await page.getByLabel('Weight',{exact:true}).fill('80');await page.getByRole('button',{name:'Save workout'}).click();
 await page.getByRole('button',{name:'Start workout'}).click();await page.getByRole('button',{name:'Complete set',exact:true}).click();await expect(page.getByText('1 of 2 sets completed')).toBeVisible();await page.reload();await page.getByRole('button',{name:'Active workout'}).click();await expect(page.getByText('1 of 2 sets completed')).toBeVisible();await page.getByRole('button',{name:'Complete set',exact:true}).click();await page.getByRole('button',{name:'Finish workout'}).click();await expect(page.getByRole('button',{name:'Session completed'})).toBeVisible();
 await page.getByRole('button',{name:'Back squat, set 1, completed',exact:true}).click();await expect(page.getByText('1 of 2 sets completed')).toBeVisible();
});
test('imports calendar safely and deduplicates',async({page})=>{
 await page.goto('/');const payload={name:'workout.ics',mimeType:'text/calendar',buffer:Buffer.from('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-1\r\nDTSTART;VALUE=DATE:20261022\r\nSUMMARY:<img src=x onerror=alert(1)>\r\nDESCRIPTION:Deadlift 3x5 @ 100kg\r\nEND:VEVENT\r\nEND:VCALENDAR')};
 await page.locator('#ics-file').setInputFiles(payload);await expect(page.getByRole('heading',{name:'<img src=x onerror=alert(1)>'})).toBeVisible();await expect(page.locator('.session-card img')).toHaveCount(0);await page.locator('#ics-file').setInputFiles(payload);await expect(page.locator('.session-card')).toHaveCount(1);await expect(page.getByRole('status')).toContainText('0 sessions imported');
});
test('production shell works offline with no horizontal overflow',async({page,context})=>{
 await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect(page.getByRole('heading',{name:'Your workout calendar.'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Your workout calendar.'})).toBeVisible();await page.getByRole('button',{name:'Schedule a workout'}).click();await expect(page.getByRole('dialog')).toBeVisible();
});
