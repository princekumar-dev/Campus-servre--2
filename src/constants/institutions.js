export const INSTITUTIONS = [
  { id: 'msec', name: 'MSEC', logo: '/images/mseclogo.webp', tileClass: 'w-[76px]', logoClass: 'h-[58px] w-auto' },
  { id: 'nest', name: 'The Nest School', logo: '/images/thenestschoollogo.webp', tileClass: 'w-full', logoClass: 'h-auto w-[82px]' },
  { id: 'mcw', name: 'MCW', logo: '/images/MCW logo.jpg', tileClass: 'w-[76px]', logoClass: 'h-[58px] w-[58px] rounded-lg' },
  { id: 'mssm', name: 'MSSM', logo: '/images/mssm.png', tileClass: 'w-full', logoClass: 'h-auto w-[86px]' },
  { id: 'iic', name: 'IIC', logo: '/images/iic.webp', tileClass: 'w-full', logoClass: 'h-auto w-[86px]' }
]

export const INSTITUTION_USER_ROLES = ['requester', 'staff', 'hod']

export const isInstitutionUserRole = role => INSTITUTION_USER_ROLES.includes(role)

export const INSTITUTION_ORGANIZATION = {
  msec: {
    requesterLabel: 'Requester (HOD/Faculty)',
    unitLabel: 'Department',
    units: ['CSE', 'ECE', 'MECH', 'CIVIL', 'IT', 'EEE', 'AIDS']
  },
  nest: {
    requesterLabel: 'Requester (Coordinator/Teacher)',
    unitLabel: 'School Section',
    units: ['Early Years', 'Primary Years', 'Middle School', 'Secondary School', 'Student Support', 'Administration']
  },
  mcw: {
    requesterLabel: 'Requester (HOD/Faculty)',
    unitLabel: 'Arts / Science Department',
    units: ['History', 'Economics', 'English', 'Mathematics', 'Physics', 'Chemistry', 'Plant Biology & Biotechnology', 'Advanced Zoology & Biotechnology', 'Computer Science', 'Commerce', 'Business Administration']
  },
  mssm: {
    requesterLabel: 'Requester (HOD/Faculty)',
    unitLabel: 'Management Department',
    units: ['General Management', 'Finance', 'Marketing', 'Human Resources', 'Operations', 'Business Analytics', 'Entrepreneurship', 'Administration']
  },
  iic: {
    requesterLabel: 'Requester (Coordinator/Member)',
    unitLabel: 'Innovation Function',
    units: ['Innovation Council', 'Innovation & Startup', 'Entrepreneurship Development', 'IPR & Technology Transfer', 'Incubation', 'Research & Development', 'Administration']
  }
}

export const getInstitutionOrganization = institution => INSTITUTION_ORGANIZATION[institution] || INSTITUTION_ORGANIZATION.msec
