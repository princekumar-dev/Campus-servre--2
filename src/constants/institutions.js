export const INSTITUTIONS = [
  { id: 'msec', name: 'MSEC', logo: '/images/mseclogo.webp', tileClass: 'w-[76px]', logoClass: 'h-[58px] w-auto' },
  { id: 'nest', name: 'The Nest School', logo: '/images/thenestschoollogo.webp', tileClass: 'w-full', logoClass: 'h-auto w-[82px]' },
  { id: 'mssm', name: 'MSSM', logo: '/images/mssm.png', tileClass: 'w-full', logoClass: 'h-auto w-[86px]' },
  // Keep the legacy `iic` value so existing users and requests remain valid.
  { id: 'iic', name: 'IIET', logo: '/images/mseclogo.webp', tileClass: 'w-[76px]', logoClass: 'h-[58px] w-auto' }
]

export const INSTITUTION_USER_ROLES = ['requester', 'staff', 'hod']

export const isInstitutionUserRole = role => INSTITUTION_USER_ROLES.includes(role)

export const INSTITUTION_ORGANIZATION = {
  msec: {
    requesterLabel: 'Requester (HOD/Faculty)',
    unitLabel: 'Department',
    units: ['CSE', 'ECE', 'MECH', 'CIVIL', 'IT', 'EEE', 'AIDS', 'Others']
  },
  nest: {
    requesterLabel: 'Requester (Coordinator/Teacher)',
    unitLabel: 'School Section',
    units: ['Early Years', 'Primary Years', 'Middle School', 'Secondary School', 'Student Support', 'Administration', 'Others']
  },
  mssm: {
    requesterLabel: 'Requester (HOD/Faculty)',
    unitLabel: 'Management Department',
    units: ['General Management', 'Finance', 'Marketing', 'Human Resources', 'Operations', 'Business Analytics', 'Entrepreneurship', 'Administration', 'Others']
  },
  iic: {
    requesterLabel: 'Requester (Coordinator/Member)',
    unitLabel: 'Innovation Function',
    units: ['Innovation Council', 'Innovation & Startup', 'Entrepreneurship Development', 'IPR & Technology Transfer', 'Incubation', 'Research & Development', 'Administration', 'Others']
  }
}

export const getInstitutionOrganization = institution => INSTITUTION_ORGANIZATION[institution] || INSTITUTION_ORGANIZATION.msec
