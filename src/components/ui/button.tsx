
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Save,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  Settings,
  User,
  Users,
  Calendar,
  Clock,
  Star,
  Heart,
  Share,
  Bookmark,
  MoreHorizontal,
  LucideIcon,
  KeyRound,
  UserPlus,
  LogIn,
  Loader2,
  Play,
  ArrowUp,
  ArrowRightLeft,
  MessageSquare,
  PlusCircle,
  GitBranch,
  CreditCard,
  ShoppingCart,
  Package,
  Boxes,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/lib/utils"

// Icon mapping for predefined button variants
const iconMap = {
  save: Save,
  edit: Edit,
  delete: Trash2,
  create: UserPlus,
  add: PlusCircle,
  search: Search,
  filter: Filter,
  download: Download,
  upload: Upload,
  send: Send,
  refresh: RefreshCw,
  preview: Eye,
  hide: EyeOff,
  copy: Copy,
  confirm: Check,
  cancel: X,
  settings: Settings,
  user: User,
  users: Users,
  calendar: Calendar,
  time: Clock,
  star: Star,
  like: Heart,
  share: Share,
  bookmark: Bookmark,
  more: MoreHorizontal,
  key: KeyRound,
  login: LogIn,
  loading: Loader2,
  play: Play,
  withdraw: ArrowUp,
  transfer: ArrowRightLeft,
  dispute: MessageSquare,
  stockRequest: GitBranch,
  sell: ShoppingCart,
  placeOrder: CreditCard,
  package: Package,
  boxes: Boxes,
  'pv-topup': TrendingUp,
} as const

export type IconVariant = keyof typeof iconMap

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  icon?: IconVariant | LucideIcon
  iconPosition?: 'left' | 'right'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    asChild = false,
    icon,
    iconPosition = 'left',
    children,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Get the icon component
    const IconComponent = icon
      ? (typeof icon === 'string' ? iconMap[icon] : icon)
      : null

    // Render icon and children based on position
    const renderContent = () => {
      const iconElement = IconComponent ? (
        <IconComponent className={cn(icon === 'loading' && 'animate-spin')} />
      ) : null;

      if (asChild) {
        // When used with Slot, we need to handle children carefully.
        // We assume the child is a single React element that can accept our icon as a prop or child.
        if (React.isValidElement(children)) {
            // Clone the child and insert the icon next to its original children.
             return React.cloneElement(children, {}, 
                iconPosition === 'left' 
                ? <>{iconElement}{children.props.children}</>
                : <>{children.props.children}{iconElement}</>
            );
        }
        return children; // Fallback for non-element children
      }

      // Default rendering for a standard button
      return (
        <>
          {iconPosition === 'left' && iconElement}
          {children}
          {iconPosition === 'right' && iconElement}
        </>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {renderContent()}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
